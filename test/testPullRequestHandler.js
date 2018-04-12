/* globals test, setup, suiteSetup, suite */
const { assert } = require('chai');
const sinon = require('sinon');
const pullRequestHandler = require('../handler-pullrequest');
const pullRequestManager = require('../manager-pullrequest');
const queueManager = require('../manager-queue');
const GitHub = require('../github');
const postal = require('postal');
const pullRequestOpenedFixture = require('./fixtures/pull_request.opened.json');
const pullRequestSynchronizedFixture = require('./fixtures/pull_request.synchronize.json');
const pullRequestClosedFixture = require('./fixtures/pull_request.closed.json');
const pullRequestMergedFixture = require('./fixtures/pull_request.merged.json');
const pullRequestInfoFixture = require('./fixtures/pull_request.info.json');
const statusFailurePayload = require('./fixtures/status.failure.json');
const statusSuccessPayload = require('./fixtures/status.success.json');
const queueItemFixture = require('./fixtures/queue.item.json');
const owner = 'branch-bookkeeper';
const repo = 'branch-bookkeeper';
const branch = 'master';
const pullRequestNumber = 1;
let gitHubSpy;
let gitHubHashSpy;
let queueManagerGetItemSpy;
let queueManagerGetFirstItemSpy;
let queueManagerGetItemsSpy;
let queueManagerRemoveItemSpy;
let pullRequestManagerGetSpy;
let pullRequestManagerSetSpy;
let pullRequestManagerShaSpy;
let postalSpy;

sinon.assert.expose(assert, { prefix: '' });

suite('PullRequestHandler', () => {
    setup(function () {
        if (!pullRequestHandler.enabled()) {
            this.skip();
        }
        gitHubSpy = sinon.stub(GitHub, 'updatePullRequestStatus').resolves('');
        gitHubHashSpy = sinon.stub(GitHub, 'getHashStatus')
            .onFirstCall()
            .resolves({ state: GitHub.STATUS_SUCCESS })
            .onSecondCall()
            .resolves({ state: GitHub.STATUS_FAILURE });
        queueManagerGetItemSpy = sinon.stub(queueManager, 'getItem').resolves(queueItemFixture);
        queueManagerGetFirstItemSpy = sinon.stub(queueManager, 'getFirstItem').resolves(queueItemFixture);
        queueManagerGetItemsSpy = sinon.stub(queueManager, 'getItems').resolves([queueItemFixture]);
        queueManagerRemoveItemSpy = sinon.stub(queueManager, 'removeItem').resolves('');
        pullRequestManagerGetSpy = sinon.stub(pullRequestManager, 'getPullRequestInfo').resolves(pullRequestInfoFixture);
        pullRequestManagerSetSpy = sinon.stub(pullRequestManager, 'setPullRequestInfo').resolves('');
        pullRequestManagerShaSpy = sinon.stub(pullRequestManager, 'getPullRequestInfoBySha').resolves(pullRequestInfoFixture);
        postalSpy = sinon.stub(postal, 'publish');
    });

    teardown(() => {
        gitHubSpy.restore();
        gitHubHashSpy.restore();
        queueManagerGetItemSpy.restore();
        queueManagerGetFirstItemSpy.restore();
        queueManagerGetItemsSpy.restore();
        queueManagerRemoveItemSpy.restore();
        pullRequestManagerGetSpy.restore();
        pullRequestManagerSetSpy.restore();
        pullRequestManagerShaSpy.restore();
        postalSpy.restore();
    });

    test('Handle closed', () => {
        const { installationId, statusUrl } = pullRequestInfoFixture;
        const { pull_request: pullRequest } = pullRequestClosedFixture;
        return pullRequestHandler.handleClosed(pullRequest)
            .then(() => {
                assert.calledWith(queueManagerGetItemSpy, owner, repo, branch, pullRequestNumber);
                assert.calledWith(
                    queueManagerRemoveItemSpy,
                    owner,
                    repo,
                    branch,
                    queueItemFixture,
                    {
                        closed: true,
                    }
                );
                assert.calledWith(pullRequestManagerGetSpy, owner, repo, pullRequestNumber);
                assert.calledWith(
                    gitHubSpy,
                    {
                        description: 'Not in the queue',
                        installationId,
                        status: GitHub.STATUS_FAILURE,
                        statusUrl,
                        targetUrl: 'fake/branch-bookkeeper/branch-bookkeeper/master/1',
                    }
                );
            });
    });

    test('Handle merged', () => {
        const { installationId, statusUrl } = pullRequestInfoFixture;
        const { pull_request: pullRequest } = pullRequestMergedFixture;
        return pullRequestHandler.handleClosed(pullRequest)
            .then(() => {
                assert.calledWith(queueManagerGetItemSpy, owner, repo, branch, pullRequestNumber);
                assert.calledWith(
                    queueManagerRemoveItemSpy,
                    owner,
                    repo,
                    branch,
                    queueItemFixture,
                    {
                        closed: true,
                    }
                );
                assert.calledWith(pullRequestManagerGetSpy, owner, repo, pullRequestNumber);
                assert.calledWith(
                    gitHubSpy,
                    {
                        description: 'Merged by branch-bookkeeper',
                        installationId,
                        status: GitHub.STATUS_SUCCESS,
                        statusUrl,
                        targetUrl: 'fake/branch-bookkeeper/branch-bookkeeper/master/1',
                    }
                );
            });
    });

    test('Handle opened', () => {
        const { pull_request: pullRequest, installation: { id: installationId } } = pullRequestOpenedFixture;
        const { statuses_url: statusUrl } = pullRequest;
        return pullRequestHandler.handleOpened(pullRequest, installationId)
            .then(() => {
                assert.calledWith(pullRequestManagerSetSpy, owner, repo, pullRequestNumber, pullRequestInfoFixture);
                assert.calledWith(
                    gitHubSpy,
                    {
                        description: 'Not in the queue',
                        installationId,
                        status: GitHub.STATUS_FAILURE,
                        statusUrl,
                        targetUrl: 'fake/branch-bookkeeper/branch-bookkeeper/master/1',
                    }
                );
            });
    });

    [[], [queueItemFixture], [1, queueItemFixture], [1, 2, 3, 4, 5, 6, queueItemFixture]].forEach(queue => {
        const position = queue.length - 1;

        test(`Handle synchronize for item in position ${position}`, () => {
            queueManagerGetItemsSpy.resolves(queue);
            const { pull_request: pullRequest, installation: { id: installationId } } = pullRequestSynchronizedFixture;
            const { statuses_url: statusUrl } = pullRequest;
            const pullRequestInfo = {
                ...pullRequestInfoFixture,
                installationId: 4567,
                assignees: [],
                statusUrl,
            };

            const status = queue.length === 1 ? GitHub.STATUS_SUCCESS : GitHub.STATUS_FAILURE;

            let description = 'First in the queue';
            if (position < 0) {
                description = 'Not in the queue';
            } else if (position > 0 && position < pullRequestHandler.MAX_REPORTED_QUEUE_POSITION) {
                description = '1 PR before this';
            } else if (position > pullRequestHandler.MAX_REPORTED_QUEUE_POSITION) {
                description = 'More than 5 PRs before this';
            }

            return pullRequestHandler.handleSync(pullRequest, installationId)
                .then(() => {
                    assert.calledWith(pullRequestManagerSetSpy, owner, repo, pullRequestNumber, pullRequestInfo);
                    assert.calledWith(queueManagerGetItemsSpy, owner, repo, branch);
                    assert.calledWith(gitHubSpy, {
                        description,
                        installationId: 1234,
                        status,
                        statusUrl: 'https://api.github.com/repos/branch-bookkeeper/branch-bookkeeper/statuses/d34d8eef',
                        targetUrl: 'fake/branch-bookkeeper/branch-bookkeeper/master/1',
                    });
                });
        });
    });

    [GitHub.STATUS_SUCCESS, GitHub.STATUS_FAILURE].forEach(status => {
        test(`Handle status change success for first item GH reports ${status}`, () => {
            const {
                sha,
                installation: { id: installationId },
                repository: { name: repo, owner: { login: owner } },
            } = statusSuccessPayload;
            const { username, pullRequestNumber } = queueItemFixture;
            return pullRequestHandler.handleStatusChange({
                owner,
                repo,
                sha,
            })
                .then(() => {
                    assert.calledWith(pullRequestManagerShaSpy, owner, repo, sha);
                    assert.calledWith(queueManagerGetFirstItemSpy, owner, repo, branch);
                    assert.calledWith(gitHubHashSpy, {
                        installationId,
                        owner,
                        repo,
                        sha,
                    });
                    assert.calledWith(postalSpy, {
                        channel: 'notification',
                        data: {
                            owner,
                            repo,
                            branch,
                            pullRequestNumber,
                            username,
                            state: GitHub.STATUS_SUCCESS,
                        },
                        topic: 'send.checks',
                    });
                });
        });
    });

    test('Handle status change success for first item GH reports pending', () => {
        gitHubHashSpy.onFirstCall().resolves({ state: GitHub.STATUS_PENDING });
        const {
            sha,
            installation: { id: installationId },
            repository: { name: repo, owner: { login: owner } },
        } = statusSuccessPayload;
        return pullRequestHandler.handleStatusChange({
            owner,
            repo,
            sha,
        })
            .then(() => {
                assert.calledWith(pullRequestManagerShaSpy, owner, repo, sha);
                assert.calledWith(queueManagerGetFirstItemSpy, owner, repo, branch);
                assert.calledWith(gitHubHashSpy, {
                    installationId,
                    owner,
                    repo,
                    sha,
                });
                assert.notCalled(postalSpy);
            });
    });

    test('Handle status change empty queue', () => {
        const { sha, repository: { name: repo, owner: { login: owner } } } = statusSuccessPayload;
        queueManagerGetFirstItemSpy.resolves(undefined);
        return pullRequestHandler.handleStatusChange({
            owner,
            repo,
            sha,
        })
            .then(() => {
                assert.calledWith(pullRequestManagerShaSpy, owner, repo, sha);
                assert.calledWith(queueManagerGetFirstItemSpy, owner, repo, branch);
                assert.notCalled(gitHubHashSpy);
                assert.notCalled(postalSpy);
            });
    });

    test('Handle status change item not in queue', () => {
        const { sha, repository: { name: repo, owner: { login: owner } } } = statusSuccessPayload;
        const firstItem = {
            ...queueItemFixture,
            pullRequestNumber: 2,
        };
        queueManagerGetFirstItemSpy.resolves(firstItem);
        return pullRequestHandler.handleStatusChange({
            owner,
            repo,
            sha,
        })
            .then(() => {
                assert.calledWith(pullRequestManagerShaSpy, owner, repo, sha);
                assert.calledWith(queueManagerGetFirstItemSpy, owner, repo, branch);
                assert.notCalled(gitHubHashSpy);
                assert.notCalled(postalSpy);
            });
    });

    test('Handle status change item not first', () => {
        const { sha, repository: { name: repo, owner: { login: owner } } } = statusSuccessPayload;
        const firstItem = {
            ...queueItemFixture,
            pullRequestNumber: 2,
        };
        queueManagerGetFirstItemSpy.resolves([firstItem, queueItemFixture]);
        return pullRequestHandler.handleStatusChange({
            owner,
            repo,
            sha,
        })
            .then(() => {
                assert.calledWith(pullRequestManagerShaSpy, owner, repo, sha);
                assert.calledWith(queueManagerGetFirstItemSpy, owner, repo, branch);
                assert.notCalled(gitHubHashSpy);
                assert.notCalled(postalSpy);
            });
    });

    test('Block', () => {
        return pullRequestHandler.blockPullRequest({
            owner,
            repo,
            pullRequestNumber,
            description: 'Description',
        })
            .then(() => {
                assert.calledWith(pullRequestManagerGetSpy, owner, repo, pullRequestNumber);
                assert.calledWith(gitHubSpy, {
                    description: 'Description',
                    installationId: 1234,
                    status: GitHub.STATUS_FAILURE,
                    statusUrl: 'https://api.github.com/repos/branch-bookkeeper/branch-bookkeeper/statuses/d34d8eef',
                    targetUrl: 'fake/branch-bookkeeper/branch-bookkeeper/master/1',
                });
            });
    });

    test('Unblock', () => {
        return pullRequestHandler.unblockPullRequest({
            owner,
            repo,
            pullRequestNumber,
            description: 'Description',
        })
            .then(() => {
                assert.calledWith(pullRequestManagerGetSpy, owner, repo, pullRequestNumber);
                assert.calledWith(gitHubSpy, {
                    description: 'Description',
                    installationId: 1234,
                    status: GitHub.STATUS_SUCCESS,
                    statusUrl: 'https://api.github.com/repos/branch-bookkeeper/branch-bookkeeper/statuses/d34d8eef',
                    targetUrl: 'fake/branch-bookkeeper/branch-bookkeeper/master/1',
                });
            });
    });
});
