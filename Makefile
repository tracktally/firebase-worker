MAKEFILE_DIR := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))

#
# We use this script to build 2 containers
# the containers dont use volumes on purpose
# so a change does not directly affect
# a running container.
#

# docker
IMAGE_NAME_MASTER=server-worker
IMAGE_NAME_DEV=server-worker-develop
IMAGE_NAME_MOTIVATION=server-worker-motivation

CONTAINER_NAME_MASTER=server-worker
CONTAINER_NAME_DEV=server-worker-develop
CONTAINER_NAME_MOTIVATION=server-worker-develop

LOG_FILE_MASTER ?=$(PWD)/log-master.txt
LOG_FILE_DEV ?=$(PWD)/log-dev.txt
LOG_FILE_MOTIVATION ?=$(PWD)/log-motivation.txt

# XXX: These run the scripts inside the container
#      we dont use volumes so a change is not directly
#      reflected.
RUN_MASTER=docker run --rm $(IMAGE_NAME_MASTER) ./run/run-master.sh \
	2>&1 | tee -a $(LOG_FILE_MASTER)

RUN_DEV=docker run --rm $(IMAGE_NAME_DEV) ./run/run-develop.sh \
	2>&1 | tee -a $(LOG_FILE_DEV)

RUN_MOTIVATION=docker run --rm $(IMAGE_NAME_MOTIVATION) ./run/run-motivation.sh \
	2>&1 | tee -a $(LOG_FILE_MOTIVATION)	

.PHONY: build-master
build-master:
	docker build -t $(IMAGE_NAME_MASTER) .	

.PHONY: build-dev
build-dev:
	docker build -t $(IMAGE_NAME_DEV) .

.PHONY: build-motivation
build-motivation:
	docker build -t $(IMAGE_NAME_MOTIVATION) .	

.PHONY: build
build: build-master build-dev build-motivation

.PHONY: run-master
run-master:
	$(RUN_MASTER)

.PHONY: run-dev
run-dev:
	$(RUN_DEV)

.PHONY: run-motivation
run-motivation:
	$(RUN_MOTIVATION)	

log-master:
	tail -f $(LOG_FILE_MASTER)

log-dev:
	tail -f $(LOG_FILE_DEV)	

log-motivation:
	tail -f $(LOG_FILE_MOTIVATION)	


# XXX: Adjust accordingly
CRON_JOB_MASTER=0 * * * * $(RUN_MASTER)
CRON_JOB_DEV=0 * * * * $(RUN_DEV)
CRON_JOB_MOTIVATION=0 21 * * * $(RUN_MOTIVATION)

.PHONY: cron
cron:
	@echo "Installing cron job: $(CRON_JOB_MASTER)"
	@echo "Installing cron job: $(CRON_JOB_DEV)"
	@echo "Installing cron job: $(CRON_JOB_MOTIVATION)"
	@(crontab -l 2>/dev/null; echo "$(CRON_JOB_MASTER)") | sort -u | crontab -
	@(crontab -l 2>/dev/null; echo "$(CRON_JOB_DEV)") | sort -u | crontab -
	@(crontab -l 2>/dev/null; echo "$(CRON_JOB_MOTIVATION)") | sort -u | crontab -
	@crontab -l

.PHONY: uncron
uncron:
	@echo "Removing cron job: $(CRON_JOB_MASTER)"
	@echo "Removing cron job: $(CRON_JOB_DEV)"
	@echo "Removing cron job: $(CRON_JOB_MOTIVATION)"
	@crontab -l 2>/dev/null | grep -v -F "$(CRON_JOB_MASTER)" | crontab -
	@crontab -l 2>/dev/null | grep -v -F "$(CRON_JOB_DEV)" | crontab -
	@crontab -l 2>/dev/null | grep -v -F "$(CRON_JOB_MOTIVATION)" | crontab -
	@crontab -l

