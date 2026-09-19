# Tools package (Phase 6)

Tools are the only way the AI touches business data, and they always go
through the Node backend - never directly to MySQL.

    AI -> tool -> Node backend API -> MySQL

Planned: order_tools.py, product_tools.py, ticket_tools.py.
Every tool validates its inputs before making a call.
