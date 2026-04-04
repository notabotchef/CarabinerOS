.PHONY: setup test clean

setup:
	pip install langextract
	@echo "✅ langextract installed"

test:
	python -m pytest tests/ -v

clean:
	rm -rf __pycache__ helpers/__pycache__ tools/__pycache__ tests/__pycache__
	rm -rf *.egg-info .pytest_cache
