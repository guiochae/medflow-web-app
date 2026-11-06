' Lanzador silencioso de WhatsApp Bridge para Medflow (sin ventana CMD)
Option Explicit
Dim WshShell, fso, scriptDir, batPath

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
batPath = scriptDir & "\start-bridge.bat"

WshShell.CurrentDirectory = scriptDir
WshShell.Run "cmd.exe /c """ & batPath & """", 0, False
