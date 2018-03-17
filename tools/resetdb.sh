#!/bin/bash
set -e

if [ -z "$MONGO_URL" ]; then
    export MONGO_URL=mongodb://localhost/branch-bookkeeper
fi

node migrations/dropDatabase.js
echo

for migration in migrations/*-*.js; do
    printf "\033[33mExecuting $migration\n\033[0m"
    node $migration;
    echo
done

printf "\033[32mDone\n\033[0m"