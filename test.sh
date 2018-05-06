#!/bin/bash
set -e

export NODE_ENV=test
export NEW_RELIC_ENABLED=false
export NEW_RELIC_APP_NAME=ugo
export NEW_RELIC_LOG=stdout
export NEW_RELIC_NO_CONFIG_FILE=true
export DATADOG_API_KEY=fake
export APP_ORIGIN=fake
export PORT=3333

if [ -z "$MONGO_URL" ]; then
    export MONGO_URL=mongodb://localhost/branch-bookkeeper-test
fi

./tools/resetdb.sh

echo
printf "\033[33mTesting with mongo\n\033[0m"

nyc --reporter=none mocha test/test* --ui tdd --timeout 2000

mv .nyc_output{,-old}

echo
printf "\033[33mTesting without mongo\n\033[0m"

unset MONGO_URL

nyc --reporter=none mocha test/test* --ui tdd --timeout 2000

cp .nyc_output-old/* .nyc_output/
rm -rf .nyc_output-old

nyc report --reporter=clover
