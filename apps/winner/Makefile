MAKEFILE_DIR := $(dir $(realpath $(lastword $(MAKEFILE_LIST))))

IMAGE=tracktally-winner
SCRIPT_DIR= ./apps/winner/scripts
BASE_DIR := $(MAKEFILE_DIR)/../..
LOG ?=$(MAKEFILE_DIR)/$(IMAGE).log
SHARE_DIR ?=$(BASE_DIR)/share

RUN=docker run --rm \
	-v $(SHARE_DIR):/app/share \
	$(IMAGE) $(SCRIPT_DIR)/run-master.ts \
	2>&1 | tee -a $(LOG)	

RUN_TEST=docker run \
	-v $(SHARE_DIR):/app/share \
	--rm $(IMAGE) $(SCRIPT_DIR)/run-test.ts 2>&1 | tee -a $(LOG)

.PHONY: build
build:
	mkdir -p $(SHARE_DIR)
	docker build -t $(IMAGE) $(BASE_DIR)

.PHONY: run
run:
	mkdir -p $(SHARE_DIR)
	$(RUN)		

test:
	$(RUN_TEST)			

log:
	tail -f $(LOG)	

# XXX: Adjust accordingly
CRON_JOB=*/15 * * * * $(RUN)

.PHONY: cron
cron:
	@echo "Installing cron job: $(CRON_JOB)"
	@(crontab -l 2>/dev/null; echo "$(CRON_JOB)") | sort -u | crontab -
	@crontab -l

.PHONY: uncron
uncron:
	@echo "Removing cron job: $(CRON_JOB)"
	@crontab -l 2>/dev/null | grep -v -F "$(CRON_JOB)" | crontab -
	@crontab -l

