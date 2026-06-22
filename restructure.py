# -*- coding: utf-8 -*-
import json, re

g=open("gen_data.py",encoding="utf-8").read()
m=re.search(r"DATA = \[.*?\n\]\n", g, flags=re.DOTALL)
nsp={}; exec(m.group(0), nsp); DATA=nsp["DATA"]
d=dict(DATA)

# --- section 4 preferred phrasing for the perseverance item ---
new4=[]
for p,r in d["צמיחה ולמידה"]:
    if p.startswith("כשאני נתקל"):
        p="כשמשהו לא מצליח, כנראה שזה פשוט לא בשבילי."
    new4.append((p,r))
d["צמיחה ולמידה"]=new4

plan=[
 ("תפיסה עצמית, מקור פרנסה והשכלה", ["תפיסה עצמית ומקור הפרנסה","השכלה והשקעה עצמית"]),
 ("זמן, כסף ובניית נכסים", ["זמן מול כסף","בניית נכסים ותכנון עתיד"]),
 ("צמיחה ולמידה", ["צמיחה ולמידה"]),
 ("תודעת שפע מול מחסור", ["תודעת שפע מול מחסור"]),
 ("תפקיד הכסף – שמירה מול יצירה", ["תפקיד הכסף – שמירה מול יצירה"]),
 ("אסטרטגיה וכלים פיננסיים", ["שמירה מול נטילת סיכון","כלים פיננסיים וחשיבה פיננסית"]),
 ("אחריות, שליטה ותגמול", ["אחריות ושליטה","תגמול לפי ערך"]),
 ("ערך עצמי וביטחון", ["ערך עצמי וביטחון"]),
 ("זהירות מול יציאה לדרך", ["זהירות מול יציאה לדרך"]),
 ("חשיבה בגדול (כמויות)", ["חשיבה בגדול (כמויות)"]),
 ("סביבה ורגשות כלפי עשירים", ["סביבה ורגשות כלפי עשירים"]),
 ("כסף, ערכים ומשפחה", ["כסף, ערכים ומשפחה"]),
]
NEW=[(n, sum([d[p] for p in parts],[])) for n,parts in plan]

J=lambda s: json.dumps(s, ensure_ascii=False)
lines=["DATA = ["]
for name,items in NEW:
    lines.append(f" ({J(name)}, [")
    for p,r in items: lines.append(f"   ({J(p)},{J(r)}),")
    lines.append(" ]),")
lines.append("]")
g2=re.sub(r"DATA = \[.*?\n\]\n", "\n".join(lines)+"\n", g, count=1, flags=re.DOTALL)
assert g2!=g
open("gen_data.py","w",encoding="utf-8").write(g2)
print("cats:",len(NEW),"items:",sum(len(i) for _,i in NEW))
