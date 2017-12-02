/* globals test, setup, suiteSetup, suite */
const { assert } = require('chai');
const sinon = require('sinon');
const postal = require('postal');
const GitHub = require('../github');
const queueManager = require('../manager-queue');
const pullRequestManager = require('../manager-pullrequest');
const queueEventHandler = require('../queue-event-handler');
const queueItemFixture = require('./fixtures/queue.item.json');
const pullRequestInfoFixture = require('./fixtures/pull_request.info.json');
const owner = 'branch-bookkeeper';
const repo = 'branch-bookkeeper';
const branch = 'master';
const item = { username: 'branch-bookkeeper' };
let gitHubSpy;
let pullRequestManagerSpy;
let queueManagerItemsSpy;
let queueManagerLengthSpy;
let postalSpy;

sinon.assert.expose(assert, { prefix: '' });

suite('QueueEventHandler', () => {
    setup(() => {
        item.pullRequestNumber =  Math.floor(Math.random() * 89) + 10;
        pullRequestInfoFixture.pullRequestNumber =  item.pullRequestNumber;
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
            item,
            index: 0,
        })
            .then(() => {
                const { pullRequestNumber, username } = item;

                assert.calledWith(postalSpy, {
                    channel: 'notification',
                    topic: 'send.rebased',
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
            item,
        }).then(() => {
            const { pullRequestNumber } = item;

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

        done();
    });

    test('Report add item', (done) => {
        queueEventHandler.reportAddItem({
            owner,
            repo,
            branch,
        });

        done();
    });

    test('Report queue size', (done) => {
        queueEventHandler.reportQueueSize({
            owner,
            repo,
            branch,
        });

        done();
    });
});
