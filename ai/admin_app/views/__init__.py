"""
Views package cho Admin App.
"""

from admin_app.views.overview import render_overview
from admin_app.views.point_manager import render_point_manager
from admin_app.views.search_tester import render_search_tester
from admin_app.views.evaluation import render_evaluation

__all__ = [
    "render_overview",
    "render_point_manager",
    "render_search_tester",
    "render_evaluation",
]
