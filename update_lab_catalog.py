import json

with open(r'C:\Users\guill\.gemini\antigravity\scratch\multimedica-system\data_raw.json', 'r', encoding='utf-8') as f:
    raw_data = json.load(f)

lab_catalog = []

def extract_labs(obj):
    if isinstance(obj, dict):
        if 'category' in obj and 'tests' in obj:
            cat = obj['category']
            for t in obj['tests']:
                t_name = t.get('name', '')
                t_price = t.get('precio', t.get('price', 50.0))
                params = t.get('parameters', [])
                unit = ''
                ref = ''
                if params:
                    p0 = params[0]
                    unit = p0.get('unit', '')
                    ref = p0.get('ref', '')
                lab_catalog.append({
                    'id': 'l-' + str(len(lab_catalog) + 1),
                    'name': t_name,
                    'category': cat,
                    'unit': unit if unit else 'N/A',
                    'reference': ref if ref else 'N/A',
                    'price': float(t_price) if t_price else 50.0
                })
        for v in obj.values():
            extract_labs(v)
    elif isinstance(obj, list):
        for item in obj:
            extract_labs(item)

extract_labs(raw_data)

# Update both medflow_db.json files
for path in [
    r'C:\Users\guill\.gemini\antigravity\scratch\gestion-consultorio\medflow_db.json',
    r'C:\Users\guill\.gemini\antigravity\scratch\gestion-consultorio\src\data\medflow_db.json'
]:
    with open(path, 'r', encoding='utf-8') as f:
        db = json.load(f)
    db['laboratoryTests'] = lab_catalog
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(db, f, indent=2, ensure_ascii=False)

print(f"Updated {len(lab_catalog)} laboratory tests with units, reference ranges, and prices!")
