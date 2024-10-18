# Infra

- https://neo4j.com/docs/operations-manual/current/docker/docker-compose-standalone/#docker-compose-basic-authentication

## Prerequisite
- Docker : https://www.docker.com/get-started

## Setup
- Create a auth.txt file in this directory, it must contain your neo4j identifier and password in this format : `username:password`.
Use neo4j as you username or it wont't work for some reason.
- Build the image with `docker compose up -d`
- Mount the container with docker.

## Run
- Go to http://localhost:7474
