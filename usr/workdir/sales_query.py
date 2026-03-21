import psycopg2

conn = psycopg2.connect(
    host='/var/run/postgresql',
    user='agent0',
    password='agent0',
    database='carabiner'
)

cursor = conn.cursor()

cursor.execute('''
    SELECT 
        mi.item_name,
        SUM(sales.quantity) as total_units,
        ROUND(SUM(sales.quantity * s.line_total), 2) as total_revenue
    FROM sales s
    JOIN menu_items mi ON s.menu_item_id = mi.id
    GROUP BY mi.item_name
    ORDER BY total_units DESC
    LIMIT 5
''')

results = cursor.fetchall()
cursor.close()
conn.close()

print("Top 5 Best Selling Items by Volume:")
print("="*50)
for row in results:
    print(f"{row[0]}: {row[1]} units | ${row[2]} revenue")
