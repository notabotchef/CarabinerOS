"""Main Typer app — composes all resource sub-commands."""

from __future__ import annotations

import typer

from carabiner.cli.commands.orders import app as orders_app
from carabiner.cli.commands.inventory import app as inventory_app
from carabiner.cli.commands.recipes import app as recipes_app
from carabiner.cli.commands.menu import app as menu_app
from carabiner.cli.commands.invoices import app as invoices_app
from carabiner.cli.commands.prep import app as prep_app
from carabiner.cli.commands.food_cost import app as food_cost_app
from carabiner.cli.commands.vendors import app as vendors_app
from carabiner.cli.commands.campaigns import app as campaigns_app

app = typer.Typer(
    name="carabiner",
    help="CarabinerOS CLI — restaurant operations from the command line.",
    no_args_is_help=True,
    pretty_exceptions_enable=False,
)

app.add_typer(orders_app, name="orders")
app.add_typer(inventory_app, name="inventory")
app.add_typer(recipes_app, name="recipes")
app.add_typer(menu_app, name="menu")
app.add_typer(invoices_app, name="invoices")
app.add_typer(prep_app, name="prep")
app.add_typer(food_cost_app, name="food-cost")
app.add_typer(vendors_app, name="vendors")
app.add_typer(campaigns_app, name="campaigns")


@app.command()
def version() -> None:
    """Print the CLI version."""
    typer.echo("carabiner 0.1.0")


if __name__ == "__main__":
    app()
