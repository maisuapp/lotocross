import os
import re
import json
from datetime import datetime, timezone
import requests
from bs4 import BeautifulSoup
from supabase import create_client, Client

# Configuração Poka-Yoke: ligação direta ao seu projeto do Supabase
SUPABASE_URL = "https://lpvisjgalthkopmddaff.supabase.co"
SUPABASE_KEY = "sb_publishable_WGkPotLdsvD3ck_z-84sbA_aK2reqgA"

supabase: Client = None
try:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
except Exception as e:
    print(f"Aviso de inicialização Supabase: {e}")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ja,en-US;q=0.9,en;q=0.8"
}

URLS = {
    "miniloto": "https://jp.lottolyzer.com/history/japan/mini-loto/page/1/per-page/10/summary-view",
    "loto6":    "https://jp.lottolyzer.com/history/japan/lotto-6/page/1/per-page/10/summary-view",
    "loto7":    "https://jp.lottolyzer.com/history/japan/lotto-7/page/1/per-page/10/summary-view"
}

RULES = {
    "miniloto": {"main_len": 5, "bonus_len": 1, "max_num": 31},
    "loto6":    {"main_len": 6, "bonus_len": 1, "max_num": 43},
    "loto7":    {"main_len": 7, "bonus_len": 2, "max_num": 37}
}

def extract_draw(lottery_type: str) -> dict:
    url = URLS[lottery_type]
    rule = RULES[lottery_type]

    res = requests.get(url, headers=HEADERS, timeout=15)
    if res.status_code != 200:
        raise ConnectionError(f"HTTP {res.status_code} ao aceder {url}")

    soup = BeautifulSoup(res.text, "html.parser")
    rows = soup.select("table tr")

    target_row = None
    for tr in rows:
        tds = tr.find_all("td")
        if len(tds) >= 4 and re.match(r"^\d+$", tds[0].get_text(strip=True)):
            target_row = tds
            break

    if not target_row:
        raise ValueError(f"Tabela de resultados não identificada para {lottery_type}")

    round_num = int(target_row[0].get_text(strip=True))
    draw_date = target_row[1].get_text(strip=True)
    raw_main = target_row[2].get_text(strip=True)
    raw_bonus = target_row[3].get_text(strip=True)

    numbers = sorted([int(n) for n in raw_main.split(",") if n.strip().isdigit()])
    bonus_numbers = [int(n) for n in raw_bonus.split(",") if n.strip().isdigit()]

    if len(numbers) != rule["main_len"] or len(bonus_numbers) != rule["bonus_len"]:
        raise ValueError(f"Dados incompletos em {lottery_type}")

    return {
        "lottery_type": lottery_type,
        "round": round_num,
        "draw_date": draw_date,
        "numbers": numbers,
        "bonus_numbers": bonus_numbers,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }

def run_sync():
    print("=" * 65)
    print("SINCRONIZANDO SORTEIOS COM O SUPABASE E CACHE LOCAL")
    print("=" * 65)

    # 1. Carregar o ficheiro latest-draws.json local, se existir
    json_path = os.path.join(os.path.dirname(__file__), "latest-draws.json")
    cached_data = {}
    if os.path.exists(json_path):
        try:
            with open(json_path, "r", encoding="utf-8") as f:
                cached_data = json.load(f)
        except Exception:
            cached_data = {}

    for lotto in ["miniloto", "loto6", "loto7"]:
        try:
            data = extract_draw(lotto)
            print(f"[{lotto.upper()}] Concurso #{data['round']} ({data['draw_date']})")
            print(f"   -> Sorteados: {data['numbers']} | Bônus: {data['bonus_numbers']}")

            # Gravação no Supabase
            if supabase:
                try:
                    supabase.table("lottery_draws").upsert(
                        {
                            "lottery_type": data["lottery_type"],
                            "round": data["round"],
                            "draw_date": data["draw_date"],
                            "numbers": data["numbers"],
                            "bonus_numbers": data["bonus_numbers"],
                            "updated_at": data["updated_at"]
                        },
                        on_conflict="lottery_type,round"
                    ).execute()
                    print("   ✓ Salvo com sucesso no Supabase!")
                except Exception as db_err:
                    print(f"   ⚠ Supabase retornou: {db_err}")

            # Gravação no ficheiro latest-draws.json para o site carregar instantaneamente
            cached_data[data["lottery_type"]] = {
                "round": data["round"],
                "draw_date": data["draw_date"],
                "numbers": data["numbers"],
                "bonus_numbers": data["bonus_numbers"],
                "updated_at": data["updated_at"]
            }

        except Exception as err:
            print(f"   ✗ Falha em {lotto}: {err}")

    # Atualiza o latest-draws.json
    try:
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(cached_data, f, indent=2, ensure_ascii=False)
        print("   ✓ Ficheiro local 'latest-draws.json' atualizado.")
    except Exception as f_err:
        print(f"   ⚠ Falha ao gravar latest-draws.json: {f_err}")

    print("=" * 65)

if __name__ == "__main__":
    run_sync()