import os
import psycopg2

conn = psycopg2.connect(os.environ["DATABASE_URL"])

with conn:
    with conn.cursor() as cursor:
        cursor.execute('''
            SELECT
                mi.item_name,
                SUM(s.quantity) as total_units,
                ROUND(SUM(s.quantity * s.line_total), 2) as total_revenue
            FROM sales s
            JOIN menu_items mi ON s.menu_item_id = mi.id
            GROUP BY mi.item_name
            ORDER BY total_units DESC
            LIMIT 5
        ''')

        results = cursor.fetchall()

conn.close()

print("Top 5 Best Selling Items by Volume:")
print("="*50)
for item_name, units, revenue in results:
    print(f"{item_name}: {units} units | ${revenue} revenue")
