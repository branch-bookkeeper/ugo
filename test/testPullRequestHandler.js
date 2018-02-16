/* globals test, setup, suiteSetup, suite */
const { assert } = require('chai');
const sinon = require('sinon');
const pullRequestHandler = require('../handler-pullrequest');
const pullRequestManager = require('../manager-pullrequest');
const queueManager = require('../manager-queue');
const GitHub = require('../github');
const pullRequestOpenedFixture = require('./fixtures/pull_request.opened.json');
const pullRequestSynchronizedFixture = require('./fixtures/pull_request.synchronize.json');
const pullRequestClosedFixture = require('./fixtures/pull_request.closed.json');
const pullRequestMergedFixture = require('./fixtures/pull_request.merged.json');
const pullRequestInfoFixture = require('./fixtures/pull_request.info.json');
const queueItemFixture = require('./fixtures/queue.item.json');
const owner = 'branch-bookkeeper';
const repo = 'branch-bookkeeper';
const branch = 'master';
const pullRequestNumber = 1;
let gitHubSpy;
let queueManagerGetItemSpy;
let queueManagerGetItemsSpy;
let queueManagerRemoveItemSpy;
let pullRequestManagerGetSpy;
let pullRequestManagerSetSpy;

sinon.assert.expose(assert, { prefix: '' });

suite('PullRequestHandler', () => {
    setup(function () {
        if (!pullRequestHandler.enabled()) {
            this.skip();
        }
        gitHubSpy = sinon.stub(GitHub, 'updatePullRequestStatus').resolves('');
        queueManagerGetItemSpy = sinon.stub(queueManager, 'getItem').resolves(queueItemFixture);
        queueManagerGetItemsSpy = sinon.stub(queueManager, 'getItems').resolves([queueItemFixture]);
        queueManagerRemoveItemSpy = sinon.stub(queueManager, 'removeItem').resolves('');
        pullRequestManagerGetSpy = sinon.stub(pullRequestManager, 'getPullRequestInfo').resolves(pullRequestInfoFixture);
        pullRequestManagerSetSpy = sinon.stub(pullRequestManager, 'setPullRequestInfo').resolves('');
    });

    teardown(() => {
        gitHubSpy.restore();
        queueManagerGetItemSpy.restore();
        queueManagerGetItemsSpy.restore();
        queueManagerRemoveItemSpy.restore();
        pullRequestManagerGetSpy.restore();
        pullRequestManagerSetSpy.restore();
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
                        description: 'Book to merge',
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
                        description: 'Book to merge',
                        installationId,
                        status: GitHub.STATUS_FAILURE,
                        statusUrl,
                        targetUrl: 'fake/branch-bookkeeper/branch-bookkeeper/master/1',
                    }
                );
            });
    });

    test('Handle synchronize', () => {
        const { pull_request: pullRequest, installation: { id: installationId } } = pullRequestSynchronizedFixture;
        const { statuses_url: statusUrl } = pullRequest;
        const pullRequestInfo = {
            ...pullRequestInfoFixture,
            installationId: 4567,
            assignees: [],
            statusUrl,
        };
        return pullRequestHandler.handleSync(pullRequest, installationId)
            .then(() => {
                assert.calledWith(pullRequestManagerSetSpy, owner, repo, pullRequestNumber, pullRequestInfo);
                assert.calledWith(queueManagerGetItemsSpy, owner, repo, branch);
                assert.calledWith(gitHubSpy, {
                    description: 'It\'s your turn',
                    installationId: 1234,
                    status: GitHub.STATUS_SUCCESS,
                    statusUrl: 'https://api.github.com/repos/branch-bookkeeper/branch-bookkeeper/statuses/d34d8eef',
                    targetUrl: 'fake/branch-bookkeeper/branch-bookkeeper/master/1',
                });
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
