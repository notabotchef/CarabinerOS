"""ApiHandler shim that registers the CarabinerOS workspace Flask blueprint.

This file lives in python/api/ so Agent Zero's handler loader picks it up.
On instantiation it registers the carabiner workspace blueprint (read-only
GET routes) on the Flask app.  The handler's own /carabiner_workspace
endpoint simply returns a list of available routes.
"""

from python.helpers.api import ApiHandler, Request, Response

_blueprint_registered = False


class CarabinerWorkspace(ApiHandler):

    def __init__(self, app, thread_lock):
        super().__init__(app, thread_lock)
        global _blueprint_registered
        if not _blueprint_registered:
            try:
                from carabiner.api.flask_blueprint import blueprint
                app.register_blueprint(blueprint)
                _blueprint_registered = True
            except Exception as e:
                # Don't crash Agent Zero if carabiner DB isn't available
                from python.helpers.print_style import PrintStyle
                PrintStyle.warning(f"CarabinerOS workspace blueprint not loaded: {e}")

    @classmethod
    def requires_auth(cls) -> bool:
        return False

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
                {"method": "GET", "path": "/api/food-cost"},
                {"method": "GET", "path": "/api/menu"},
                {"method": "GET", "path": "/api/campaigns"},
                {"method": "GET", "path": "/api/recipes"},
                {"method": "GET", "path": "/api/invoices"},
                {"method": "GET", "path": "/api/reporting/daily-pl"},
            ],
            "filter": "All routes accept optional ?location_id=UUID query parameter",
        }
