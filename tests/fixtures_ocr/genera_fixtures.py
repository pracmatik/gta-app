#!/usr/bin/env python3
"""Regenera els 2 escanejos de prova de l'OCR (dades 100% FICTÍCIES, cap dada de client).
   · escaneig_net.png    — amidament típic dibuixat com a imatge (taula amb graella), A4 a 200 ppp
   · escaneig_advers.png — el mateix, maltractat com un escaneig d'oficina: girat 1,2°, paper grisós,
                           soroll, desenfocament lleu i compressió JPEG agressiva (q=55)
   Les quantitats i paraules esperades viuen a tests/test_ocr_escanejat.js — si canvies res aquí, canvia-ho allà."""
import random
from PIL import Image, ImageDraw, ImageFont, ImageFilter

F = "/System/Library/Fonts/Supplemental/Arial.ttf"
FB = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
big = ImageFont.truetype(FB, 34); h2 = ImageFont.truetype(FB, 28)
n = ImageFont.truetype(F, 25); nb = ImageFont.truetype(FB, 25)
W, H = 1654, 2339  # A4 a 200 ppp
img = Image.new("RGB", (W, H), "white"); d = ImageDraw.Draw(img)
y = 120

def center(t, f, y):
    w = d.textlength(t, font=f); d.text(((W - w) / 2, y), t, font=f, fill="black"); return y + f.size + 14

y = center("AMIDAMENTS · REHABILITACIO DE FAÇANA", big, y)
y = center("CARRER DE MOSTRA 12, BARCELONA — Codi obra G26.999", n, y) + 30

def taula(titol, files, y):
    d.text((120, y), titol, font=h2, fill="black"); y += h2.size + 18
    cols = [120, 300, 1180, 1330]; wid = [180, 880, 150, 204]
    def fila(vals, font, y, alt=54):
        for i, (x, w, v) in enumerate(zip(cols, wid, vals)):
            d.rectangle([x, y, x + w, y + alt], outline="black", width=2)
            if i == 3:
                tw = d.textlength(v, font=font); d.text((x + w - tw - 12, y + 12), v, font=font, fill="black")
            else:
                d.text((x + 12, y + 12), v, font=font, fill="black")
        return y + alt
    y = fila(["Num", "Descripcio", "Ut", "Amidament"], nb, y)
    for f in files: y = fila(f, n, y)
    return y + 40

y = taula("CAPITOL 1. TREBALLS PREVIS I MITJANS AUXILIARS", [
    ["1.1", "Muntatge i desmuntatge de bastida tubular", "m2", "240,00"],
    ["1.2", "Lloguer de bastida, mes addicional", "m2", "240,00"],
    ["1.3", "Xarxa de proteccio i lona microperforada", "m2", "252,50"]], y)
y = taula("CAPITOL 2. FAÇANA PRINCIPAL", [
    ["2.1", "Repicat de revestiment en mal estat", "m2", "96,40"],
    ["2.2", "Arrebossat reglejat i acabat remolinat", "m2", "96,40"],
    ["2.3", "Pintat amb pintura al silicat, dues mans", "m2", "310,80"]], y)
img.save("escaneig_net.png")

random.seed(7)
adv = img.convert("L").rotate(1.2, expand=True, fillcolor=235, resample=Image.BICUBIC)
px = adv.load(); AW, AH = adv.size
for _ in range(AW * AH // 18):
    x = random.randrange(AW); yy = random.randrange(AH)
    px[x, yy] = max(0, min(255, px[x, yy] + random.randint(-46, 46)))
adv = adv.point(lambda v: min(255, v + 14)).filter(ImageFilter.GaussianBlur(0.6))
adv.convert("RGB").save("_adv.jpg", quality=55)
Image.open("_adv.jpg").convert("RGB").save("escaneig_advers.png")
import os; os.remove("_adv.jpg")
print("fixtures regenerades:", img.size, adv.size)
