"""Product catalog tool. Not customer-scoped — the catalog is public
information, so the only thing this tool needs is a search term."""
from app.tools.base import ToolError, internal_request


async def get_product_information(query: str, limit: int = 5) -> dict:
    if not query or not query.strip():
        raise ToolError("query must not be empty.")

    result = await internal_request("GET", "/products", params={"search": query.strip(), "limit": limit})
    products = result.get("products", [])
    return {
        "found": len(products) > 0,
        "products": [
            {
                "name": p["name"],
                "category": p.get("category"),
                "price": p["price"],
                "in_stock": p["stock"] > 0,
                "warranty_months": p.get("warrantyMonths"),
                "description": p.get("description"),
            }
            for p in products
        ],
    }
