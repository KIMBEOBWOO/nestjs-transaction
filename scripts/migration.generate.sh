#!/bin/sh

# The first parameter should provide an Database Name to which migration will be applied.
# Select postgres-main, postgres-sub
DBName=$1

# The third parameter provides the path through which the migration file will be created
GeneratedMigrationFilePath=$2

yarn ts-node ./node_modules/typeorm/cli.js \
    -d=./test/fixtures/database/data-sources/${DBName}.ts \
    migration:generate \
    ./test/fixtures/database/migrations/${DBName}/${GeneratedMigrationFilePath}
