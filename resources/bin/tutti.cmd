@echo off
rem El comando `tutti` de la terminal: el instalador pone esta carpeta (resources\bin) en el PATH del usuario.
rem   tutti            abre el ultimo proyecto
rem   tutti .          abre la carpeta actual como proyecto
rem   tutti <ruta>     una carpeta como proyecto, o un archivo con su repositorio
setlocal
set "first=%~1"
if defined first if not "%first:~0,1%"=="-" if not exist "%first%" (echo tutti: no existe %first% 1>&2 & exit /b 1)
rem `start` abre la app aparte: la terminal queda libre y la app recibe esta carpeta como la de trabajo
start "" "%~dp0..\..\tutti.exe" %*
