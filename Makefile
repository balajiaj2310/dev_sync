.PHONY: help install migrate migrations seed run test test-v2 docker-up docker-down lint clean

help:
	@echo "DevSync Engineering Makefile Commands:"
	@echo "  install      Install python dependencies"
	@echo "  migrate      Apply database migrations"
	@echo "  migrations   Generate new migrations"
	@echo "  seed         Seed demo developers, repositories, and intelligence events"
	@echo "  run          Start local development server with Daphne/Channels"
	@echo "  test         Run complete pytest test suite with coverage"
	@echo "  docker-up    Start all production services with Docker Compose"
	@echo "  docker-down  Stop Docker Compose services"
	@echo "  clean        Remove bytecode and temporary caches"

install:
	pip install -r requirements.txt

migrations:
	python manage.py makemigrations

migrate:
	python manage.py migrate

seed:
	python manage.py seed_demo

run:
	python manage.py runserver 0.0.0.0:8000

test:
	pytest -v

docker-up:
	docker compose up --build -d

docker-down:
	docker compose down

clean:
	find . -type d -name "__pycache__" -exec rm -rf {} +
	rm -rf .pytest_cache
