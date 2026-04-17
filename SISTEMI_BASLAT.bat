@echo off
title Operasyonel Analiz Suite (AI Edition)
color 0A

echo %time% - Sistem baslatildi. Lutfen Siyah Ekrani Kapatmayiniz...

:: Tarayicinizda projeyi otomatik olarak aciyorum
start "" "http://localhost:8999"

:: Kendi yerel kutunuzdaki mini NodeJS statik web sunucusunu calistiriyorum
"C:\Program Files\nodejs\node.exe" server.js

pause
