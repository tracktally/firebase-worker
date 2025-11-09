MAKEFILE_DIR := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))
SCRIPT_DIR= ./apps/maintenance/scripts
BASE_DIR= ../../

IMAGE_NAME_MASTER=tracktally-maintenance
IMAGE_NAME_DEV=tracktally-maintenance-develop

LOG_FILE_MASTER ?=$(PWD)/$(IMAGE_NAME_MASTER).log
LOG_FILE_DEV ?=$(PWD)/$(IMAGE_NAME_DEV).log

# XXX: These run the scripts inside the container
#      we dont use volumes so a change is not directly
#      reflected.
RUN_MASTER=docker run --rm $(IMAGE_NAME_MASTER) $(SCRIPT_DIR)/run-master.ts \
	2>&1 | tee -a $(LOG_FILE_MASTER)

RUN_DEV=docker run --rm $(IMAGE_NAME_DEV) $(SCRIPT_DIR)/run-develop.ts \
	2>&1 | tee -a $(LOG_FILE_DEV)


.PHONY: build
build: build-master build-dev

.PHONY: build-master
build-master:
	docker build -t $(IMAGE_NAME_MASTER) $(BASE_DIR)	

.PHONY: build-dev
build-dev:
	docker build -t $(IMAGE_NAME_DEV) $(BASE_DIR)

.PHONY: run-master
run-master:
	$(RUN_MASTER)

.PHONY: run-dev
run-dev:
	$(RUN_DEV)


log-master:
	tail -f $(LOG_FILE_MASTER)

log-dev:
	tail -f $(LOG_FILE_DEV)	

# XXX: Adjust accordingly
CRON_JOB_MASTER=0 * * * * $(RUN_MASTER)
CRON_JOB_DEV=0 * * * * $(RUN_DEV)


.PHONY: cron
cron:
	@echo "Installing cron job: $(CRON_JOB_MASTER)"
	@echo "Installing cron job: $(CRON_JOB_DEV)"

	@(crontab -l 2>/dev/null; echo "$(CRON_JOB_MASTER)") | sort -u | crontab -
	@(crontab -l 2>/dev/null; echo "$(CRON_JOB_DEV)") | sort -u | crontab -
	@crontab -l

.PHONY: uncron
uncron:
	@echo "Removing cron job: $(CRON_JOB_MASTER)"
	@echo "Removing cron job: $(CRON_JOB_DEV)"

	@crontab -l 2>/dev/null | grep -v -F "$(CRON_JOB_MASTER)" | crontab -
	@crontab -l 2>/dev/null | grep -v -F "$(CRON_JOB_DEV)" | crontab -
	@crontab -l

