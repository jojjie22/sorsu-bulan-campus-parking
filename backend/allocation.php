<?php
/** Deterministic, explainable parking assignment with bounded query count. */
declare(strict_types=1);

/** Stable score, exposed separately for deterministic fixture tests. */
function allocationScore(bool $preferred, int $priority, float $freeRatio, bool $exactType): float {
    return round(($preferred ? 100 : 0) + min(100,max(0,$priority))*0.4
        + max(0,min(1,$freeRatio))*40 + ($exactType ? 5 : 0), 2);
}

function allocationCandidates(int $vehicleId, bool $lock=false): array {
    $vehicle=query('SELECT vehicle_type,user_id FROM vehicles WHERE id=?',[$vehicleId])->fetch();
    if (!$vehicle) gateReject('Vehicle not found',404);
    $preference=query('SELECT preferred_area_id FROM user_parking_preferences WHERE user_id=?',[$vehicle['user_id']])->fetchColumn();

    // First lock eligible slot rows in stable ID order. This serializes concurrent
    // gate choices; the existing unique active-slot constraint is the final safeguard.
    $sql="SELECT s.id,s.code,s.area_id,s.vehicle_type,a.name area,
                 COALESCE(policy.allocation_priority,50) priority,
                 COALESCE(policy.enabled,1) policy_enabled
          FROM parking_slots s
          JOIN parking_areas a ON a.id=s.area_id
          LEFT JOIN parking_area_policies policy ON policy.area_id=s.area_id
          WHERE s.status='active' AND (s.vehicle_type='any' OR s.vehicle_type=?)
          ORDER BY s.id";
    $slots=query($sql.($lock?' FOR UPDATE':''),[$vehicle['vehicle_type']])->fetchAll();
    if (!$slots) return [];

    // Set-based occupancy lookup: no N+1 queries for large campus parking lots.
    $occupiedRows=query('SELECT slot_id FROM parking_visits WHERE exit_at IS NULL')->fetchAll();
    $occupied=array_fill_keys(array_column($occupiedRows,'slot_id'),true);
    $capacity=[];
    foreach ($slots as $slot) {
        if (!(int)$slot['policy_enabled']) continue;
        $area=(int)$slot['area_id'];
        $capacity[$area]??=['total'=>0,'free'=>0];
        $capacity[$area]['total']++;
        if (!isset($occupied[$slot['id']])) $capacity[$area]['free']++;
    }
    $ranked=[];
    foreach ($slots as $slot) {
        if (!(int)$slot['policy_enabled'] || isset($occupied[$slot['id']])) continue;
        $area=(int)$slot['area_id'];
        $total=$capacity[$area]['total'];
        $free=$capacity[$area]['free'];
        $preferred=$preference!==false && (int)$preference===$area;
        $ratio=$free/max(1,$total);
        $slot['score']=allocationScore($preferred,(int)$slot['priority'],$ratio,
            $slot['vehicle_type']===$vehicle['vehicle_type']);
        $slot['preferred']=$preferred;
        $slot['capacity_ratio']=round($ratio,3);
        $slot['free_compatible']=$free;
        $slot['total_compatible']=$total;
        $ranked[]=$slot;
    }
    usort($ranked,static fn($a,$b)=>($b['score']<=>$a['score'])
        ?: strcmp($a['area'],$b['area'])
        ?: strcmp($a['code'],$b['code'])
        ?: ($a['id']<=>$b['id']));
    return $ranked;
}
