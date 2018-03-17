#!/bin/bash

if [ -z "$NODE_ENV" ]; then
    export NODE_ENV=development
fi

if [ -z "$APP_ID" ]; then
    export APP_ID=
fi

if [ -z "$APP_ORIGIN" ]; then
    export APP_ORIGIN=https://app.branch-bookkeeper.com
fi

if [ -z "$MONGO_URL" ]; then
    export MONGO_URL=mongodb://localhost/branch-bookkeeper
fi

set -e

node updatePullRequestStatus

printf "\033[32mDone\n\033[0m"