#!/bin/bash

if [ -z "$PROD_MONGO_URL" ]; then
    export PROD_MONGO_URL=
fi
if [ -z "$MONGO_URL" ]; then
    export MONGO_URL=mongodb://localhost/branch-bookkeeper
fi

set -e

printf "\033[32mExport DB\n\033[0m"
mongodump --uri ${PROD_MONGO_URL} -o ./dump

printf "\033[32mReset DB\n\033[0m"
./resetdb.sh

printf "\033[32mImport DB\n\033[0m"
mongorestore --uri ${MONGO_URL} --dir ./dump

rm -rf ./dump

printf "\033[32mDone\n\033[0m"

