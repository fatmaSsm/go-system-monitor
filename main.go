package main

import (
	"fmt"
	"os"
	"runtime"
	"time"

	"github.com/shirou/gopsutil/v4/cpu"
	"github.com/shirou/gopsutil/v4/disk"
	"github.com/shirou/gopsutil/v4/host"
	"github.com/shirou/gopsutil/v4/mem"
)

const (
	reset  = "\033[0m"
	green  = "\033[32m"
	yellow = "\033[33m"
	red    = "\033[31m"
	cyan   = "\033[36m"
	bold   = "\033[1m"
)

func statusLabel(value float64, highThreshold float64, criticalThreshold float64) string {
	if value >= criticalThreshold {
		return "Critical"
	}

	if value >= highThreshold {
		return "High"
	}

	return "Normal"
}

func colorStatus(status string) string {
	switch status {
	case "Normal":
		return green + status + reset
	case "High":
		return yellow + status + reset
	case "Critical":
		return red + status + reset
	default:
		return status
	}
}

func printSection(title string) {
	fmt.Println()
	fmt.Printf("%s%s%s\n", bold, title, reset)
	fmt.Println("------------------")
}

func showSystemInfo() {
	hostname, err := os.Hostname()
	if err != nil {
		fmt.Printf("%sError reading hostname: %v%s\n", red, err, reset)
		return
	}

	printSection("System Information")

	fmt.Printf("Hostname: %s\n", hostname)
	fmt.Printf("Operating System: %s\n", runtime.GOOS)
	fmt.Printf("Architecture: %s\n", runtime.GOARCH)
}

func showMemoryInfo() {
	memory, err := mem.VirtualMemory()
	if err != nil {
		fmt.Printf("%sError reading memory information: %v%s\n", red, err, reset)
		return
	}

	totalGB := float64(memory.Total) / 1024 / 1024 / 1024
	usedGB := float64(memory.Used) / 1024 / 1024 / 1024
	availableGB := float64(memory.Available) / 1024 / 1024 / 1024

	status := statusLabel(memory.UsedPercent, 75, 90)

	printSection("Memory Information")

	fmt.Printf("Total RAM: %.2f GB\n", totalGB)
	fmt.Printf("Used RAM: %.2f GB\n", usedGB)
	fmt.Printf("Available RAM: %.2f GB\n", availableGB)
	fmt.Printf("Usage: %.2f%%\n", memory.UsedPercent)
	fmt.Printf("RAM Status: %s\n", colorStatus(status))
}

func showCPUInfo() {
	logicalCores, err := cpu.Counts(true)
	if err != nil {
		fmt.Printf("%sError reading CPU count: %v%s\n", red, err, reset)
		return
	}

	info, err := cpu.Info()
	if err != nil {
		fmt.Printf("%sError reading CPU information: %v%s\n", red, err, reset)
		return
	}

	usage, err := cpu.Percent(time.Second, false)
	if err != nil {
		fmt.Printf("%sError reading CPU usage: %v%s\n", red, err, reset)
		return
	}

	printSection("CPU Information")

	fmt.Printf("Logical Cores: %d\n", logicalCores)

	if len(info) > 0 {
		fmt.Printf("Model: %s\n", info[0].ModelName)
	}

	if len(usage) > 0 {
		status := statusLabel(usage[0], 60, 85)

		fmt.Printf("Usage: %.2f%%\n", usage[0])
		fmt.Printf("CPU Status: %s\n", colorStatus(status))
	}
}

func showDiskInfo() {
	diskInfo, err := disk.Usage("C:\\")
	if err != nil {
		fmt.Printf("%sError reading disk information: %v%s\n", red, err, reset)
		return
	}

	totalGB := float64(diskInfo.Total) / 1024 / 1024 / 1024
	usedGB := float64(diskInfo.Used) / 1024 / 1024 / 1024
	freeGB := float64(diskInfo.Free) / 1024 / 1024 / 1024

	status := statusLabel(diskInfo.UsedPercent, 75, 90)

	printSection("Disk Information")

	fmt.Printf("Drive: C:\\\n")
	fmt.Printf("Total Space: %.2f GB\n", totalGB)
	fmt.Printf("Used Space: %.2f GB\n", usedGB)
	fmt.Printf("Free Space: %.2f GB\n", freeGB)
	fmt.Printf("Usage: %.2f%%\n", diskInfo.UsedPercent)
	fmt.Printf("Disk Status: %s\n", colorStatus(status))
}

func showUptime() {
	uptimeSeconds, err := host.Uptime()
	if err != nil {
		fmt.Printf("%sError reading system uptime: %v%s\n", red, err, reset)
		return
	}

	days := uptimeSeconds / 86400
	hours := (uptimeSeconds % 86400) / 3600
	minutes := (uptimeSeconds % 3600) / 60

	printSection("System Uptime")

	fmt.Printf(
		"Uptime: %d days, %d hours, %d minutes\n",
		days,
		hours,
		minutes,
	)
}

func main() {
	fmt.Printf("%s%sGo System Monitor%s\n", bold, cyan, reset)
	fmt.Println("=================")

	showSystemInfo()
	showMemoryInfo()
	showCPUInfo()
	showDiskInfo()
	showUptime()
}
