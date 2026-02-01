!macro customInit
  IfFileExists "$INSTDIR\\Uninstall ${PRODUCT_NAME}.exe" 0 done
  MessageBox MB_ICONEXCLAMATION|MB_OK "LocalScribe is already installed. Please uninstall it before installing this version."
  Abort
  done:
!macroend

!macro customUnInstall
  MessageBox MB_YESNO|MB_ICONQUESTION "Do you want to remove LocalScribe user data (AppData)?" IDYES removeData IDNO done
  removeData:
    RMDir /r "$APPDATA\\LocalScribe"
  done:
!macroend
