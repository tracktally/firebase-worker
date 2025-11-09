IMAGE=tracktally-motivation
SCRIPT_DIR= ./apps/motivation/scripts
BASE_DIR= ../../
LOG ?=$(PWD)/$(IMAGE).log

RUN_MOTIVATION=docker run --rm $(IMAGE) $(SCRIPT_DIR)/run-master.ts \
	2>&1 | tee -a $(LOG)	

.PHONY: build
build
	docker build -t $(IMAGE) .	

.PHONY: run
run:
	$(RUN_MOTIVATION)		

log-motivation:
	tail -f $(LOG)	

# XXX: Adjust accordingly
CRON_JOB_MOTIVATION=0 21 * * * $(RUN_MOTIVATION)

.PHONY: cron
cron:
	@echo "Installing cron job: $(CRON_JOB_MOTIVATION)"
	@(crontab -l 2>/dev/null; echo "$(CRON_JOB_MOTIVATION)") | sort -u | crontab -
	@crontab -l

.PHONY: uncron
uncron:
	@echo "Removing cron job: $(CRON_JOB_MOTIVATION)"
	@crontab -l 2>/dev/null | grep -v -F "$(CRON_JOB_MOTIVATION)" | crontab -
	@crontab -l

