#!/bin/bash

for pkg in www/node_modules/@feezal/*; do
    (cd $pkg; npm publish --access public)
done