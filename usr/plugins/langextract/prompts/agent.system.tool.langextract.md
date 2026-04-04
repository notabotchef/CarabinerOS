### langextract
structured extraction from unstructured text (invoices receipts recipes prep lists)
uses LLM + few-shot examples to pull structured data with source grounding
built-in schemas: invoice, recipe, prep_list

#### langextract:extract
general extraction with custom prompt and examples
args text prompt examples(optional json array) output_name(optional)
usage:
~~~json
{
    ...
    "tool_name": "langextract:extract",
    "tool_args": {
        "text": "raw text to extract from...",
        "prompt": "Extract all product names and prices",
        "examples": [{"text": "Widget $5", "extractions": [{"extraction_class": "product", "extraction_text": "Widget", "attributes": {"price": "5"}}]}],
        "output_name": "my_extraction"
    }
}
~~~

#### langextract:extract_invoice
extract vendor, line items, quantities, prices from invoice or delivery ticket
args text output_name(optional)
usage:
~~~json
{
    ...
    "tool_name": "langextract:extract_invoice",
    "tool_args": {
        "text": "SYSCO FOODS\nInvoice #: INV-2026-04821\nPrime Ribeye 12 LB $18.50 $222.00..."
    }
}
~~~

#### langextract:extract_recipe
extract ingredients, steps, techniques, temps from a recipe
args text output_name(optional)
usage:
~~~json
{
    ...
    "tool_name": "langextract:extract_recipe",
    "tool_args": {
        "text": "Sauce Béarnaise\nYield: 2 cups\n1/4 cup white wine vinegar..."
    }
}
~~~

#### langextract:extract_prep
extract prep tasks, stations, quantities, priorities from prep lists
args text output_name(optional)
~~~json
{
    ...
    "tool_name": "langextract:extract_prep",
    "tool_args": {
        "text": "PREP LIST — Friday\nStation: Garde Manger\n- Pickled onions: 2 qt..."
    }
}
~~~

#### langextract:schemas
list available built-in extraction schemas
no args needed
~~~json
{
    ...
    "tool_name": "langextract:schemas",
    "tool_args": {}
}
~~~
