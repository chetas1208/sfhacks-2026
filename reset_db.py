from backend import db

print("Resetting collections...")
res = db.reset_collections()
print(res)
print("Done.")
