/* globals test, setup, suiteSetup, suite */
const { assert } = require('chai');
const sinon = require('sinon');
const postal = require('postal');
const GitHub = require('../github');
const queueManager = require('../manager-queue');
const pullRequestManager = require('../manager-pullrequest');
const queueEventHandler = require('../handler-event-queue');
const queueItemFixture = {
    ...require('./fixtures/queue.item.json'),
    pullRequestNumber: Math.floor(Math.random() * 89) + 10,
};
const pullRequestInfoFixture = {
    ...require('./fixtures/pull_request.info.json'),
    pullRequestNumber: queueItemFixture.pullRequestNumber,
};
const owner = 'branch-bookkeeper';
const repo = 'branch-bookkeeper';
const branch = 'master';
let gitHubSpy;
let pullRequestManagerSpy;
let queueManagerItemsSpy;
let queueManagerLengthSpy;
let postalSpy;

sinon.assert.expose(assert, { prefix: '' });

suite('QueueEventHandler', () => {
    setup(() => {
        postalSpy = sinon.stub(postal, 'publish');
        gitHubSpy = sinon.stub(GitHub, 'updatePullRequestStatus').resolves('');
        pullRequestManagerSpy = sinon.stub(pullRequestManager, 'getPullRequestInfo').resolves(pullRequestInfoFixture);
        queueManagerItemsSpy = sinon.stub(queueManager, 'getItems').resolves([queueItemFixture]);
        queueManagerLengthSpy = sinon.stub(queueManager, 'getLength').resolves(3);
    });

    teardown(() => {
        postalSpy.restore();
        gitHubSpy.restore();
        pullRequestManagerSpy.restore();
        queueManagerItemsSpy.restore();
        queueManagerLengthSpy.restore();
    });

    test('Add item', () => {
        return queueEventHandler.addItem({
            owner,
            repo,
            branch,
            item: queueItemFixture,
            index: 0,
        })
            .then(() => {
                const { pullRequestNumber, username } = queueItemFixture;

                assert.calledWith(postalSpy, {
                    channel: 'notification',
                    topic: 'send.queue.first',
                    data: {
                        owner,
                        repo,
                        pullRequestNumber,
                        username,
                    },
                });

                assert.calledWith(gitHubSpy, {
                    status: GitHub.STATUS_SUCCESS,
                    description: 'It\'s your turn',
                    statusUrl: `https://api.github.com/repos/${owner}/${repo}/statuses/d34d8eef`,
                    installationId: 1234,
                    targetUrl: `${process.env.APP_ORIGIN}/${owner}/${repo}/${branch}/${pullRequestNumber}`,
                });
            });
    });

    test('Remove item', () => {
        queueEventHandler.removeItem({
            owner,
            repo,
            branch,
            item: queueItemFixture,
        }).then(() => {
            const { pullRequestNumber } = queueItemFixture;

            assert.calledWith(postalSpy, {
                channel: 'notification',
                topic: 'send.update',
                data: {
                    owner,
                    repo,
                    branch,
                    items: [],
                },
            });

            assert.calledWith(gitHubSpy, {
                status: GitHub.STATUS_FAILURE,
                description: 'Book to merge',
                statusUrl: `https://api.github.com/repos/${owner}/${repo}/statuses/d34d8eef`,
                installationId: 1234,
                targetUrl: `${process.env.APP_ORIGIN}/${owner}/${repo}/${branch}/${pullRequestNumber}`,
            });
        });
    });

    test('Report remove item', (done) => {
        queueEventHandler.reportRemoveItem({
            owner,
            repo,
            branch,
        });
        assert.calledWith(postalSpy, {
            channel: 'metrics',
            topic: 'increment',
            data: {
                name: 'queue.item.remove',
                tags: [`queue:${owner}:${repo}:${branch}`],
            },
        });
        done();
    });

    test('Report add item', (done) => {
        queueEventHandler.reportAddItem({
            owner,
            repo,
            branch,
        });
        assert.calledWith(postalSpy, {
            channel: 'metrics',
            topic: 'increment',
            data: {
                name: 'queue.item.add',
                tags: [`queue:${owner}:${repo}:${branch}`],
            },
        });
        done();
    });

    test('Report queue size', () => {
        return queueEventHandler.reportQueueSize({
            owner,
            repo,
            branch,
        })
            .then(() => {
                assert.calledWith(postalSpy, {
                    channel: 'metrics',
                    topic: 'gauge',
                    data: {
                        name: 'queue.length',
                        value: 3,
                        tags: [`queue:${owner}:${repo}:${branch}`],
                    },
                });
            });
    });

    test('Push queue update', () => {
        return queueEventHandler.pushQueueUpdate({
            owner,
            repo,
            branch,
        })
            .then(() => {
                assert.calledWith(
                    queueManagerItemsSpy,
                    owner,
                    repo,
                    branch
                );

                assert.calledWith(postalSpy, {
                    channel: 'notification',
                    topic: 'send.update',
                    data: {
                        owner,
                        repo,
                        branch,
                        items: [queueItemFixture],
                    },
                });
            });
    });
});
