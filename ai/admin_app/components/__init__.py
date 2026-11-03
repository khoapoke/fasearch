"""
Components package cho Admin App.
Tập hợp các thành phần giao diện tái sử dụng (Sidebar, Image Card, Seeder Box, Helpers).
"""

from admin_app.components.sidebar import render_sidebar
from admin_app.components.seeder_box import render_seeder_box
from admin_app.components.image_card import render_point_card, render_search_result_card
from admin_app.components.dialog import confirm_reset_dialog, confirm_delete_dialog
from admin_app.components.ui_helpers import (
    resolve_image_path,
    get_status_badge,
    get_catalog_badge,
    save_admin_uploaded_image,
    open_folder_dialog,
    scan_folder_direct_images,
)

__all__ = [
    "confirm_reset_dialog",
    "confirm_delete_dialog",
    "render_sidebar",
    "render_seeder_box",
    "render_point_card",
    "render_search_result_card",
    "resolve_image_path",
    "get_status_badge",
    "get_catalog_badge",
    "save_admin_uploaded_image",
    "open_folder_dialog",
    "scan_folder_direct_images",
]
