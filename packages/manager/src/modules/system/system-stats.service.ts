import { exec } from 'node:child_process';
import { totalmem, freemem, platform } from 'node:os';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export interface SystemStats {
  cpuPercent: number;
  ramUsedBytes: number;
  ramTotalBytes: number;
  vramLabel: string;
  processCpuPercent: number | null;
  processRamBytes: number | null;
}

class SystemStatsService {
  private vramLabelCache: string | null = null;

  private async detectVramLabel(): Promise<string> {
    try {
      if (platform() === 'darwin') {
        const { stdout: archOut } = await execAsync('uname -m', {
          timeout: 1000,
        });
        if (archOut.trim() === 'arm64') {
          const gb = Math.round(totalmem() / 1_073_741_824);
          return `Unified ${gb}GB`;
        }
        // Intel Mac: parse system_profiler
        const { stdout } = await execAsync(
          "system_profiler SPDisplaysDataType 2>/dev/null | grep -i 'VRAM'",
          { timeout: 4000 },
        );
        const match = stdout.match(/VRAM[^:]*:\s*(.+)/i);
        return match?.[1]?.trim() ?? 'N/A';
      }
      // Linux: try nvidia-smi
      const { stdout } = await execAsync(
        'nvidia-smi --query-gpu=memory.total --format=csv,noheader 2>/dev/null | head -1',
        { timeout: 2000 },
      );
      const trimmed = stdout.trim();
      return trimmed || 'N/A';
    } catch {
      return 'N/A';
    }
  }

  async getVramLabel(): Promise<string> {
    if (this.vramLabelCache !== null) return this.vramLabelCache;
    this.vramLabelCache = await this.detectVramLabel();
    return this.vramLabelCache;
  }

  async getCpuPercent(): Promise<number> {
    try {
      if (platform() === 'darwin') {
        const { stdout } = await execAsync(
          "top -l 1 -n 0 -s 0 2>/dev/null | grep 'CPU usage'",
          { timeout: 2000 },
        );
        const user = parseFloat(stdout.match(/([\d.]+)%\s+user/)?.[1] ?? '0');
        const sys = parseFloat(stdout.match(/([\d.]+)%\s+sys/)?.[1] ?? '0');
        return Math.round(user + sys);
      }
      // Linux: parse /proc/stat (single-sample — approx since-boot average)
      const { stdout } = await execAsync(
        "grep '^cpu ' /proc/stat | awk '{idle=$5; total=0; for(i=2;i<=NF;i++) total+=$i; print int((total-idle)*100/total)}'",
        { timeout: 1000 },
      );
      return parseInt(stdout.trim(), 10) || 0;
    } catch {
      return 0;
    }
  }

  getRam(): { used: number; total: number } {
    const total = totalmem();
    const free = freemem();
    return { used: total - free, total };
  }

  async getProcessStats(
    pid: number,
  ): Promise<{ cpuPercent: number; ramBytes: number } | null> {
    // pid comes from Node's child_process, always a positive integer — safe to interpolate
    try {
      const { stdout } = await execAsync(
        `ps -p ${pid} -o %cpu,rss 2>/dev/null`,
        { timeout: 1000 },
      );
      const line = stdout.trim().split('\n')[1]?.trim();
      if (!line) return null;
      const [cpuStr, rssStr] = line.split(/\s+/);
      const cpu = parseFloat(cpuStr ?? '0');
      const rssKb = parseInt(rssStr ?? '0', 10);
      return { cpuPercent: isNaN(cpu) ? 0 : cpu, ramBytes: rssKb * 1024 };
    } catch {
      return null;
    }
  }

  async getSnapshot(pid: number | null = null): Promise<SystemStats> {
    const ram = this.getRam();
    const [cpuPercent, vramLabel, processStats] = await Promise.all([
      this.getCpuPercent(),
      this.getVramLabel(),
      pid !== null ? this.getProcessStats(pid) : Promise.resolve(null),
    ]);

    return {
      cpuPercent,
      ramUsedBytes: ram.used,
      ramTotalBytes: ram.total,
      vramLabel,
      processCpuPercent: processStats?.cpuPercent ?? null,
      processRamBytes: processStats?.ramBytes ?? null,
    };
  }
}

export const systemStatsService = new SystemStatsService();
