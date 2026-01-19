#Requires AutoHotkey v2.0
#Include "UIA.ahk"

SetTitleMatchMode(2)

SFind(Name, WinTitle := "A") { ;Find_Element
    if (WinTitle = "A")
        WinTitle := WinExist("A")
    try {
        window := UIA.ElementFromHandle(WinExist(WinTitle))
        return window.FindElement({Name: Name})
    }
    catch {
        return false
    }
}



SFindWait(Name,  WinTitle := "A", MaxAttempts := 10, IntervalMS := 250) { ;Find_ElementWait
    Loop MaxAttempts {
        if element := SFind(Name, WinTitle) {
            return element
        }
        Sleep(IntervalMS)
    }
    return false
}

SFindOR(Names*) {
    WinTitle := "A"
    try {
        ; 1. Get the window element
        hwnd := WinExist(WinTitle)
        if !hwnd
            return false
        window := UIA.ElementFromHandle(hwnd)

        ; 2. Build the "OR" condition array: [{Name:"Name1"}, {Name:"Name2"}, ...]
        Conditions := []
        for Name in Names {
            Conditions.Push({Name: Name, MatchMode: "RegEx"})
        }

        ; 3. Use the built-in OR search (throws TargetError if none match)
        return window.FindElement(Conditions)
    }
    catch {
        return false
    }
}

SFindWaitOR(Names*) { ;Find_ElementWait
    WinTitle := "A"
    MaxAttempts := 10
    IntervalMS := 250
    
    Loop MaxAttempts {
        if element := SFindOR(Names) {
            return element
        }
        Sleep(IntervalMS)
    }
    return false
}

SClick(Name, WinTitle := "A") { ;Find_Click
    try {
        if element := SFind(Name, WinTitle) {
            element.Click()
            return true
        }
    }
    catch {
        return false
    }
    return false
}

SClickWait(elementName, clickType :="left", Interval:="250", WinTitle := "A"){
    element := SFindWait(elementName, , Interval)
    SClickRelative(element, clickType)
}

SClickRelative(element, clickType := "left", offsetX := 0, offsetY := 0) {
    if not IsObject(element)
        return false
    
    try {
        CoordMode("Mouse", "Screen")
        rect := element.BoundingRectangle
        
        centerX := rect.l + (rect.r - rect.l) // 2
        centerY := rect.t + (rect.b - rect.t) // 2
        
        Click(centerX + offsetX, centerY + offsetY, clickType)
        return true
    }
    catch {
        return false
    }
}

SFindList(WinTitle := "A") { ;FindList
    displayTitle := WinTitle
    if (WinTitle = "A") {
        WinTitle := WinExist("A")
        displayTitle := WinGetTitle(WinTitle)
    }

    if !WinExist(WinTitle) {
        MsgBox("Window not found: " . displayTitle)
        return
    }

    try {
        window := UIA.ElementFromHandle(WinExist(WinTitle))
        allElements := window.FindAll()
        elementListString := ""

        For element in allElements {
            elementListString .= element.Dump() . "`n--------------------`n"
        }

        if (elementListString = "") {
            MsgBox("UIA connection successful, but no UI elements were found inside the window.")
            return
        }

        myGui := Gui(, "UIA Spy Results for '" . displayTitle . "'")
        myGui.SetFont("s10", "Consolas")
        myGui.Add("Edit", "w800 h600 ReadOnly", elementListString)
        myGui.Show()
    }
    catch as e {
        MsgBox("An error occurred while trying to list elements: `n`n" . e.Message)
    }
}