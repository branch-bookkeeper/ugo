#!/bin/bash
set -e

export NODE_ENV=test
export NEW_RELIC_ENABLED=false
export NEW_RELIC_APP_NAME=ugo
export NEW_RELIC_LOG=stdout
export NEW_RELIC_NO_CONFIG_FILE=true
export DATADOG_API_KEY=fake
if [ -z "$MONGO_URL" ]; then
    export MONGO_URL=mongodb://localhost/branch-bookkeeper-test
fi

./resetdb.sh

echo
printf "\033[33mTesting with mongo\n\033[0m"

node_modules/.bin/babel-istanbul cover --report clover node_modules/.bin/_mocha -- test/test* --ui tdd --reporter dot --timeout 10000

mv coverage/coverage.{json,mongo.json}

echo
printf "\033[33mTesting without mongo\n\033[0m"

unset MONGO_URL

node_modules/.bin/babel-istanbul cover --report clover node_modules/.bin/_mocha -- test/test* --ui tdd --reporter dot --timeout 10000

node_modules/.bin/istanbul report --report clover
