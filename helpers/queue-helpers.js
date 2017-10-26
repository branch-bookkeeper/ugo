const unpackQueueName = (queueName) => {
    const [owner, repo, branch] = queueName.split(':');

    return { owner, repo, branch };
};

module.exports = {
    unpackQueueName,
};
