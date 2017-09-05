#!/bin/bash
set -e

export NODE_ENV=test
if [ -z "$REDIS_URL" ]; then
    export REDIS_URL=redis://localhost
fi

echo Testing with redis

node_modules/.bin/istanbul cover --report clover node_modules/.bin/_mocha -- test/test* --ui tdd --reporter dot --timeout 10000

mv coverage/coverage.{json,redis.json}

echo Testing without redis

unset REDIS_URL

node_modules/.bin/istanbul cover --report clover node_modules/.bin/_mocha -- test/test* --ui tdd --reporter dot --timeout 10000

node_modules/.bin/istanbul report --report clover
