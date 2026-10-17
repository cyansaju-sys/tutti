; El comando `tutti` de la terminal: la carpeta resources\bin (con tutti.cmd) entra en el PATH del usuario al instalar y sale
; al desinstalar. El PATH se cambia con PowerShell, leído sin expandir (las entradas con %VARIABLE% se quedan como están): las
; funciones de cadena de NSIS lo cortan a 1024 caracteres y lo dejarían roto.
!include WinMessages.nsh

; ACTION: add o remove. La carpeta llega por entorno, así sus comillas o apóstrofos no rompen el comando.
!macro tuttiPath ACTION
  System::Call 'Kernel32::SetEnvironmentVariable(t "TUTTI_BIN", t "$INSTDIR\resources\bin")'
  nsExec::Exec `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "$$d = $$env:TUTTI_BIN; $$k = Get-Item 'HKCU:\Environment'; $$old = [string]$$k.GetValue('Path', '', 'DoNotExpandEnvironmentNames'); $$parts = @($$old -split ';' | Where-Object { $$_ -and $$_ -ne $$d }); if ('${ACTION}' -eq 'add') { $$parts += $$d }; $$new = $$parts -join ';'; if ($$new -ne $$old) { Set-ItemProperty 'HKCU:\Environment' -Name Path -Value $$new -Type ExpandString }"`
  Pop $0
  SendMessage ${HWND_BROADCAST} ${WM_SETTINGCHANGE} 0 "STR:Environment" /TIMEOUT=5000      ; las terminales que se abran ya lo ven
!macroend

!macro customInstall
  !insertmacro tuttiPath add
!macroend

!macro customUnInstall
  ${ifNot} ${isUpdated}          ; al actualizar, el instalador nuevo lo deja igual
    !insertmacro tuttiPath remove
  ${endIf}
!macroend
