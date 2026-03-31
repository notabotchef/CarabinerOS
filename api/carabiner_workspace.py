"""ApiHandler shim that registers the CarabinerOS workspace Flask blueprint.

This file lives in api/ so Agent Zero's handler loader picks it up.
On instantiation it registers the carabiner workspace blueprint (read-only
GET routes) on the Flask app.  The handler's own /carabiner_workspace
endpoint simply returns a list of available routes.
"""

from helpers.api import ApiHandler, Request, Response

_blueprint_registered = False


class CarabinerWorkspace(ApiHandler):

    def __init__(self, app, thread_lock):
        super().__init__(app, thread_lock)
        global _blueprint_registered
        if not _blueprint_registered:
            try:
                from carabiner.api.flask_blueprint import blueprint
                app.register_blueprint(blueprint)
                from carabiner.api.prep_routes import prep_blueprint
                app.register_blueprint(prep_blueprint)
                _blueprint_registered = True
            except Exception as e:
                # Don't crash Agent Zero if carabiner DB isn't available
                from helpers.print_style import PrintStyle
                PrintStyle.warning(f"CarabinerOS workspace blueprint not loaded: {e}")

    @classmethod
    def requires_auth(cls) -> bool:
        return True

    @classmethod
    def requires_csrf(cls) -> bool:
        return False

    @classmethod
    def get_methods(cls) -> list[str]:
        return ["GET"]

    async def process(self, input: dict, request: Request) -> dict | Response:
        """Return a manifest of available workspace API routes."""
        return {
            "service": "carabiner-workspace",
            "routes": [
                {"method": "GET", "path": "/api/orders"},
                {"method": "GET", "path": "/api/inventory"},
                {"method": "GET", "path": "/api/prep"},
                {"method": "GET", "path": "/api/prep/today"},
                {"method": "GET", "path": "/api/prep/lists"},
                {"method": "GET", "path": "/api/prep/lists/:id"},
                {"method": "PATCH", "path": "/api/prep/lists/:id"},
                {"method": "POST", "path": "/api/prep/items"},
                {"method": "PATCH", "path": "/api/prep/items/:id"},
                {"method": "PATCH", "path": "/api/prep/items/:id/complete"},
                {"method": "DELETE", "path": "/api/prep/items/:id"},
                {"method": "GET", "path": "/api/prep/stations"},
                {"method": "POST", "path": "/api/prep/stations"},
                {"method": "GET", "path": "/api/food-cost"},
                {"method": "GET", "path": "/api/menu"},
                {"method": "GET", "path": "/api/campaigns"},
                {"method": "GET", "path": "/api/recipes"},
                {"method": "GET", "path": "/api/invoices"},
                {"method": "GET", "path": "/api/reporting/daily-pl"},
            ],
            "filter": "All routes accept optional ?location_id=UUID query parameter",
        }
