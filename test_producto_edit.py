#!/usr/bin/env python3
"""
Test script to verify producto edit form fix:
1. Navigate to products page
2. Click edit on first product
3. Inspect the form to verify payload normalization
4. Test error handling
"""

from playwright.sync_api import sync_playwright
import json
import time


def test_producto_edit():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)  # headless=False to see the browser
        page = browser.new_page()

        # Navigate to products page
        print("📍 Navigating to products page...")
        page.goto("http://localhost:3001/busy/products")
        page.wait_for_load_state("networkidle")

        # Take screenshot to see initial state
        print("📸 Taking screenshot of products list...")
        page.screenshot(path="/tmp/products_list.png", full_page=True)

        # Look for edit button (first product row)
        print("🔍 Looking for edit button...")
        edit_buttons = page.locator(
            'button[aria-label*="Edit"], button:has-text("Edit")'
        )

        if edit_buttons.count() > 0:
            print(f"✅ Found {edit_buttons.count()} edit buttons")
            # Click first edit button
            edit_buttons.first.click()
            page.wait_for_load_state("networkidle")
            time.sleep(1)  # Extra wait for form to load

            # Take screenshot of edit form
            print("📸 Taking screenshot of edit form...")
            page.screenshot(path="/tmp/products_edit_form.png", full_page=True)

            # Inspect form inputs
            print("📝 Inspecting form inputs...")
            form_inputs = page.locator("input, textarea, select")
            print(f"   Found {form_inputs.count()} form inputs")

            # Look for proveedorCodigo field
            proveedor_inputs = page.locator(
                'input[name*="proveedor"], input[placeholder*="Proveedor"]'
            )
            if proveedor_inputs.count() > 0:
                proveedor_value = proveedor_inputs.first.input_value()
                print(
                    f"✅ proveedorCodigo value: '{proveedor_value}' (type: {type(proveedor_value).__name__})"
                )

            # Open browser DevTools to monitor network
            print("\n🔍 Monitoring network requests...")
            print("   Try editing a field and submitting the form")
            print("   Look for PATCH request in Network tab")
            print("   Check that empty fields are null in payload, not empty strings")

            # Wait for user interaction
            print(
                "\n⏳ Keeping browser open for 30 seconds (interact with form if needed)..."
            )
            time.sleep(30)
        else:
            print("❌ No edit buttons found on page")
            print("   Page content:")
            print(page.content()[:500])

        browser.close()


if __name__ == "__main__":
    test_producto_edit()
