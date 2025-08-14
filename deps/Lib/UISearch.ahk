#Requires AutoHotkey v2.0
#Include "UIA.ahk"

SetTitleMatchMode(2)

Find_Element(Name, WinTitle := "A") {
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

Find_Click(Name, WinTitle := "A") {
    try {
        if element := Find_Element(Name, WinTitle) {
            element.Click()
            return true
        }
    }
    catch {
        return false
    }
    return false
}

Find_ElementWait(Name,  WinTitle := "A", MaxAttempts := 10, IntervalMS := 250) {
    Loop MaxAttempts {
        if element := Find_Element(Name, WinTitle) {
            return element
        }
        Sleep(IntervalMS)
    }
    return false
}

ClickWait(elementName, clickType :="left", Interval:="250", WinTitle := "A"){
    element := Find_ElementWait(elementName, , Interval)
    ClickRelative(element, clickType)
}

ClickRelative(element, clickType := "left", offsetX := 0, offsetY := 0) {
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

Find_List(WinTitle := "A") {
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