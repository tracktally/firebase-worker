build:
	cd ./apps/winner && make build && \
	cd ../motivation && make build && \
	cd ../maintenance && make build
