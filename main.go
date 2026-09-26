package main

import (
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/shirou/gopsutil/v4/cpu"
	"github.com/shirou/gopsutil/v4/disk"
	"github.com/shirou/gopsutil/v4/host"
	"github.com/shirou/gopsutil/v4/mem"
	gnet "github.com/shirou/gopsutil/v4/net"
	"github.com/shirou/gopsutil/v4/process"
)

type SystemInfo struct {
	Hostname     string `json:"hostname"`
	OS           string `json:"os"`
	Architecture string `json:"architecture"`
}

type MemoryInfo struct {
	TotalGB     float64 `json:"total_gb"`
	UsedGB      float64 `json:"used_gb"`
	AvailableGB float64 `json:"available_gb"`
	Usage       float64 `json:"usage"`
	Status      string  `json:"status"`
}

type CPUInfo struct {
	Model         string  `json:"model"`
	LogicalCores  int     `json:"logical_cores"`
	PhysicalCores int     `json:"physical_cores"`
	Processes     int     `json:"processes"`
	Threads       int     `json:"threads"`
	Usage         float64 `json:"usage"`
	Status        string  `json:"status"`
}

type DiskInfo struct {
	Drive   string  `json:"drive"`
	TotalGB float64 `json:"total_gb"`
	UsedGB  float64 `json:"used_gb"`
	FreeGB  float64 `json:"free_gb"`
	Usage   float64 `json:"usage"`
	Status  string  `json:"status"`
}

type UptimeInfo struct {
	Days    uint64 `json:"days"`
	Hours   uint64 `json:"hours"`
	Minutes uint64 `json:"minutes"`
}

type NetworkInfo struct {
	Connected       bool    `json:"connected"`
	Interface       string  `json:"interface"`
	DownloadMbps    float64 `json:"download_mbps"`
	UploadMbps      float64 `json:"upload_mbps"`
	TotalReceivedGB float64 `json:"total_received_gb"`
	TotalSentGB     float64 `json:"total_sent_gb"`
}

type BatteryInfo struct {
	Available        bool    `json:"available"`
	Name             string  `json:"name"`
	Percentage       float64 `json:"percentage"`
	Status           string  `json:"status"`
	PowerSource      string  `json:"power_source"`
	EstimatedMinutes int     `json:"estimated_minutes"`
	HealthAvailable  bool    `json:"health_available"`
	HealthPercent    float64 `json:"health_percent"`
}

type MetricsResponse struct {
	Memory  MemoryInfo  `json:"memory"`
	CPU     CPUInfo     `json:"cpu"`
	Disk    DiskInfo    `json:"disk"`
	Uptime  UptimeInfo  `json:"uptime"`
	Network NetworkInfo `json:"network"`
	Battery BatteryInfo `json:"battery"`
}

type networkSample struct {
	received uint64
	sent     uint64
	at       time.Time
}

var (
	networkMu   sync.Mutex
	lastNetwork networkSample
)

func statusLabel(value, highThreshold, criticalThreshold float64) string {
	if value >= criticalThreshold {
		return "Critical"
	}
	if value >= highThreshold {
		return "High"
	}
	return "Normal"
}

func systemHandler(w http.ResponseWriter, r *http.Request) {
	hostname, err := os.Hostname()
	if err != nil {
		http.Error(w, "Unable to read hostname", http.StatusInternalServerError)
		return
	}

	response := SystemInfo{
		Hostname:     hostname,
		OS:           runtime.GOOS,
		Architecture: runtime.GOARCH,
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(response); err != nil {
		http.Error(w, "Unable to encode system information", http.StatusInternalServerError)
	}
}

func isVirtualOrSpecialInterface(name string) bool {
	name = strings.ToLower(name)
	blocked := []string{
		"loopback",
		"bluetooth",
		"vmware",
		"virtualbox",
		"vethernet",
		"hyper-v",
		"tailscale",
		"zerotier",
		"npcap",
		"docker",
		"wsl",
	}

	for _, part := range blocked {
		if strings.Contains(name, part) {
			return true
		}
	}
	return false
}

func interfacePriority(name string) int {
	name = strings.ToLower(name)
	switch {
	case strings.Contains(name, "wi-fi"), strings.Contains(name, "wifi"), strings.Contains(name, "wlan"):
		return 30
	case strings.Contains(name, "ethernet"), strings.HasPrefix(name, "eth"):
		return 20
	default:
		return 10
	}
}

func findActiveInterface() string {
	interfaces, err := net.Interfaces()
	if err != nil {
		return ""
	}

	bestName := ""
	bestPriority := -1

	for _, iface := range interfaces {
		if iface.Name == "" || isVirtualOrSpecialInterface(iface.Name) {
			continue
		}

		if iface.Flags&net.FlagLoopback != 0 {
			continue
		}

		addresses, err := iface.Addrs()
		if err != nil || len(addresses) == 0 {
			continue
		}

		hasUsableAddress := false
		for _, address := range addresses {
			ipText := address.String()
			ip, _, parseErr := net.ParseCIDR(ipText)
			if parseErr != nil {
				ip = net.ParseIP(strings.Split(ipText, "%")[0])
			}

			if ip == nil || ip.IsLoopback() || ip.IsUnspecified() || ip.IsLinkLocalUnicast() {
				continue
			}

			hasUsableAddress = true
			break
		}

		if !hasUsableAddress {
			continue
		}

		priority := interfacePriority(iface.Name)
		if priority > bestPriority {
			bestPriority = priority
			bestName = iface.Name
		}
	}

	return bestName
}

func readNetwork() NetworkInfo {
	info := NetworkInfo{Interface: "Unavailable"}

	activeInterface := findActiveInterface()
	if activeInterface != "" {
		info.Connected = true
		info.Interface = activeInterface
	}

	counters, err := gnet.IOCounters(false)
	if err != nil || len(counters) == 0 {
		return info
	}

	current := counters[0]
	now := time.Now()

	info.TotalReceivedGB = float64(current.BytesRecv) / 1024 / 1024 / 1024
	info.TotalSentGB = float64(current.BytesSent) / 1024 / 1024 / 1024

	networkMu.Lock()
	defer networkMu.Unlock()

	if !lastNetwork.at.IsZero() {
		seconds := now.Sub(lastNetwork.at).Seconds()
		if seconds > 0 {
			if current.BytesRecv >= lastNetwork.received {
				info.DownloadMbps = float64(current.BytesRecv-lastNetwork.received) * 8 / seconds / 1_000_000
			}
			if current.BytesSent >= lastNetwork.sent {
				info.UploadMbps = float64(current.BytesSent-lastNetwork.sent) * 8 / seconds / 1_000_000
			}
		}
	}

	lastNetwork = networkSample{
		received: current.BytesRecv,
		sent:     current.BytesSent,
		at:       now,
	}

	return info
}

func readBattery() BatteryInfo {
	result := BatteryInfo{Status: "Unavailable", PowerSource: "Unknown", Name: "Battery"}
	if runtime.GOOS != "windows" {
		return result
	}

	script := `$ErrorActionPreference='SilentlyContinue';
$b=Get-CimInstance Win32_Battery | Select-Object -First 1;
if(-not $b){ exit 0 };
$static=Get-CimInstance -Namespace root/wmi -ClassName BatteryStaticData | Select-Object -First 1;
$full=Get-CimInstance -Namespace root/wmi -ClassName BatteryFullChargedCapacity | Select-Object -First 1;
$health=$null; if($static -and $full -and $static.DesignedCapacity -gt 0 -and $full.FullChargedCapacity -gt 0){$health=[math]::Round(($full.FullChargedCapacity/$static.DesignedCapacity)*100,1)};
$status='Available'; $source='Unknown';
switch([int]$b.BatteryStatus){1{$status='Discharging';$source='On Battery'};2{$status='AC Connected';$source='AC Power'};3{$status='Full';$source='AC Power'};6{$status='Charging';$source='AC Power'};7{$status='Charging';$source='AC Power'};8{$status='Charging';$source='AC Power'};9{$status='Charging';$source='AC Power'};11{$status='Partially Charged';$source='AC Power'};default{$status='Available'}};
[pscustomobject]@{name=([string]$b.Name);percentage=[double]$b.EstimatedChargeRemaining;status=$status;power_source=$source;estimated_minutes=([int]$b.EstimatedRunTime);health_percent=$health}|ConvertTo-Json -Compress`
	cmd := exec.Command("powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script)
	out, err := cmd.Output()
	if err != nil || len(strings.TrimSpace(string(out))) == 0 {
		return result
	}

	var payload struct {
		Name             string   `json:"name"`
		Percentage       float64  `json:"percentage"`
		Status           string   `json:"status"`
		PowerSource      string   `json:"power_source"`
		EstimatedMinutes int      `json:"estimated_minutes"`
		HealthPercent    *float64 `json:"health_percent"`
	}
	if err := json.Unmarshal(out, &payload); err != nil {
		return result
	}

	result.Available = true
	if strings.TrimSpace(payload.Name) != "" {
		result.Name = payload.Name
	}
	result.Percentage = payload.Percentage
	result.Status = payload.Status
	result.PowerSource = payload.PowerSource
	if payload.EstimatedMinutes > 0 && payload.EstimatedMinutes < 71582788 {
		result.EstimatedMinutes = payload.EstimatedMinutes
	}
	if payload.HealthPercent != nil && *payload.HealthPercent > 0 {
		result.HealthAvailable = true
		result.HealthPercent = *payload.HealthPercent
		if result.HealthPercent > 100 {
			result.HealthPercent = 100
		}
	}
	return result
}

func metricsHandler(w http.ResponseWriter, r *http.Request) {
	memory, err := mem.VirtualMemory()
	if err != nil {
		http.Error(w, "Unable to read memory information", http.StatusInternalServerError)
		return
	}

	cpuInfo, err := cpu.Info()
	if err != nil {
		http.Error(w, "Unable to read CPU information", http.StatusInternalServerError)
		return
	}

	cpuUsage, err := cpu.Percent(500*time.Millisecond, false)
	if err != nil {
		http.Error(w, "Unable to read CPU usage", http.StatusInternalServerError)
		return
	}

	logicalCores, _ := cpu.Counts(true)
	physicalCores, _ := cpu.Counts(false)

	diskRoot := "/"
	if runtime.GOOS == "windows" {
		diskRoot = "C:\\"
	}

	diskUsage, err := disk.Usage(diskRoot)
	if err != nil {
		http.Error(w, "Unable to read disk information", http.StatusInternalServerError)
		return
	}

	uptimeSeconds, err := host.Uptime()
	if err != nil {
		http.Error(w, "Unable to read system uptime", http.StatusInternalServerError)
		return
	}

	processes, processErr := process.Processes()
	processCount := 0
	totalThreads := 0
	if processErr == nil {
		processCount = len(processes)
		for _, proc := range processes {
			threads, threadErr := proc.NumThreads()
			if threadErr == nil {
				totalThreads += int(threads)
			}
		}
	}

	totalRAM := float64(memory.Total) / 1024 / 1024 / 1024
	usedRAM := float64(memory.Used) / 1024 / 1024 / 1024
	availableRAM := float64(memory.Available) / 1024 / 1024 / 1024

	totalDisk := float64(diskUsage.Total) / 1024 / 1024 / 1024
	usedDisk := float64(diskUsage.Used) / 1024 / 1024 / 1024
	freeDisk := float64(diskUsage.Free) / 1024 / 1024 / 1024

	days := uptimeSeconds / 86400
	hours := (uptimeSeconds % 86400) / 3600
	minutes := (uptimeSeconds % 3600) / 60

	cpuModel := "Unknown"
	if len(cpuInfo) > 0 && strings.TrimSpace(cpuInfo[0].ModelName) != "" {
		cpuModel = cpuInfo[0].ModelName
	}

	cpuPercent := 0.0
	if len(cpuUsage) > 0 {
		cpuPercent = cpuUsage[0]
	}

	response := MetricsResponse{
		Memory: MemoryInfo{
			TotalGB:     totalRAM,
			UsedGB:      usedRAM,
			AvailableGB: availableRAM,
			Usage:       memory.UsedPercent,
			Status:      statusLabel(memory.UsedPercent, 75, 90),
		},
		CPU: CPUInfo{
			Model:         cpuModel,
			LogicalCores:  logicalCores,
			PhysicalCores: physicalCores,
			Processes:     processCount,
			Threads:       totalThreads,
			Usage:         cpuPercent,
			Status:        statusLabel(cpuPercent, 60, 85),
		},
		Disk: DiskInfo{
			Drive:   diskRoot,
			TotalGB: totalDisk,
			UsedGB:  usedDisk,
			FreeGB:  freeDisk,
			Usage:   diskUsage.UsedPercent,
			Status:  statusLabel(diskUsage.UsedPercent, 75, 90),
		},
		Uptime: UptimeInfo{
			Days:    days,
			Hours:   hours,
			Minutes: minutes,
		},
		Network: readNetwork(),
		Battery: readBattery(),
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(response); err != nil {
		http.Error(w, "Unable to encode monitoring data", http.StatusInternalServerError)
	}
}

func createMux() *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/system", systemHandler)
	mux.HandleFunc("/api/metrics", metricsHandler)

	distDir := filepath.Join("web", "dist")
	if info, err := os.Stat(distDir); err == nil && info.IsDir() {
		fileServer := http.FileServer(http.Dir(distDir))
		mux.Handle("/assets/", fileServer)

		mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path == "/" || r.URL.Path == "/index.html" {
				http.ServeFile(w, r, filepath.Join(distDir, "index.html"))
				return
			}

			relativePath := strings.TrimLeft(filepath.Clean(r.URL.Path), `/\\`)
			candidate := filepath.Join(distDir, relativePath)
			if _, err := os.Stat(candidate); err == nil {
				http.ServeFile(w, r, candidate)
				return
			}

			http.ServeFile(w, r, filepath.Join(distDir, "index.html"))
		})
	} else {
		mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "text/plain; charset=utf-8")
			fmt.Fprintln(w, "Go System Monitor API is running.")
			fmt.Fprintln(w)
			fmt.Fprintln(w, "Development frontend: http://localhost:5173")
			fmt.Fprintln(w, "API endpoints:")
			fmt.Fprintln(w, "  /api/system")
			fmt.Fprintln(w, "  /api/metrics")
		})
	}

	return mux
}

func main() {
	fmt.Println("Go System Monitor API running at http://localhost:8080")
	if err := http.ListenAndServe(":8080", createMux()); err != nil {
		fmt.Printf("Server error: %v\n", err)
	}
}
