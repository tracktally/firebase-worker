IMAGE=tracktally-winner
SCRIPT_DIR= ./apps/winner/scripts
BASE_DIR= ../../
LOG ?=$(PWD)/$(IMAGE).log

RUN=docker run --rm $(IMAGE) $(SCRIPT_DIR)/run-master.ts \
	2>&1 | tee -a $(LOG)	

RUN_TEST=docker run --rm $(IMAGE) $(SCRIPT_DIR)/run-test.ts 2>&1 | tee -a $(LOG)

.PHONY: build
build:
	docker build -t $(IMAGE) $(BASE_DIR)

.PHONY: run
run:
	$(RUN)		

test:
	$(RUN_TEST)			

log:
	tail -f $(LOG)	

# XXX: Adjust accordingly
CRON_JOB=*/30 * * * $(RUN)

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

