#Requires AutoHotkey v2.0

SetTitleMatchMode "RegEx"
#Include "UISearch.ahk"

Insert::{
    target := "ChatGPT - Japanese Sentence Breakdown ahk_exe firefox.exe"


    pasteText(){
        
        
        element := SFindWaitOR("Ask Anything", "New chat in*")
        if(element){
            ;ToolTip("Found this : " element.Name)
            Send '^v'
        }

        else{
            MsgBox "Could not find words."
        }
        
    }
    
    if(!WinExist(target)){
        Run('firefox.exe -new-window "https://chatgpt.com/g/g-p-68b8b834b5dc8191baf9d693caaf6794-japanese-sentence-breakdown/project"')
        WinWait(target)
        WinActivate(target)
        pasteText()
        return
    }



    if(!WinActive(target))
    {
        WinActivate(target)
    }

    

    pasteText()
    
}