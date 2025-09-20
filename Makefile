# Image and container settings
IMAGE_NAME=server-worker
CONTAINER_NAME=server-worker
LOG_FILE=$(PWD)/log.txt


.PHONY: build
build:
	docker build -t $(IMAGE_NAME) .


.PHONY: run
run:
	@docker run --rm --name $(CONTAINER_NAME) $(IMAGE_NAME) >> $(LOG_FILE) 2>&1


.PHONY: logs
logs:
	tail -f $(LOG_FILE)


CRON_JOB=*/15 * * * * docker run --rm -v $(PWD):/usr/src/app $(IMAGE_NAME) >> $(LOG_FILE) 2>&1

.PHONY: cron
cron:
	@(crontab -l 2>/dev/null; echo "$(CRON_JOB)") | sort -u | crontab -

.PHONY: uncron
uncron:
	@crontab -l 2>/dev/null | grep -v -F "$(CRON_JOB)" | crontab -

