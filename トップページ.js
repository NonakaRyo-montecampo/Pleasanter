$p.events.on_grid_load = function () {
    const TRAFTABLE_ID = 9; // 交通費精算テーブルID

    (async () => {
        // =========================================================================
        // ▼ 設定エリア：監視したい条件のリスト
        // =========================================================================
        const NOTIFICATION_CONFIG = [
            {
                tableName: "交通費申請",
                tableId: TRAFTABLE_ID,
                linkUrl: "/items/" + TRAFTABLE_ID,
                conditions: [
                    { type: "user",  targetCol: "ClassB", statusNum: 200, label: "上長承認待ち" },
                    { type: "group", targetId: 2,   statusNum: 300, label: "決済待ち" },
                    { type: "group", targetId: 3,   statusNum: 400, label: "総務承認待ち" },
                    { type: "user",  targetCol: "ClassC", statusNum: 500, label: "精算待ち" },
                    { type: "user",  targetCol: "ClassA", statusNum: 910, label: "差し戻し" }
                ]
            }
        ];
        // =========================================================================

        const currentUserId = String($p.userId());

        // --- ヘルパー関数 ---
        const isUserInGroup = (groupId) => {
            if (typeof $p.groupIds === 'function') {
                return $p.groupIds().includes(Number(groupId));
            }
            return false;
        };

        const getRecordCount = async (tableId, filterHash) => {
            return new Promise((resolve) => {
                $p.apiGet({
                    id: tableId,
                    data: { 
                        View: { ColumnFilterHash: filterHash },
                        PageSize: 1 
                    },
                    done: function(res) { resolve(res.Response.TotalCount || 0); },
                    fail: function() { resolve(0); }
                });
            });
        };

        // --- メイン処理 ---
        let finalHtml = "";
        let hasAnyNotification = false;

        for (const config of NOTIFICATION_CONFIG) {
            let tableNotifications = [];

            for (const cond of config.conditions) {
                let filterHash = {};
                let shouldCheck = false;

                if (cond.type === "group") {
                    if (isUserInGroup(cond.targetId)) {
                        filterHash = { Status: `[${cond.statusNum}]` };
                        shouldCheck = true;
                    }
                } 
                else if (cond.type === "user") {
                    filterHash = { 
                        Status: `[${cond.statusNum}]`,
                        [cond.targetCol]: JSON.stringify([currentUserId]) 
                    };
                    shouldCheck = true;
                }

                if (shouldCheck) {
                    const count = await getRecordCount(config.tableId, filterHash);
                    if (count > 0) {
                        const msg = (cond.statusNum === 910) 
                            ? `<span style='color: #d9534f; font-weight: bold;'>${count}件の「差し戻し」された交通費申請があります。対応をお願いします。</span>`
                            : `${count}件の状態「${cond.label}」の交通費申請があります。`;
                        tableNotifications.push(`<li style="margin-bottom: 3px;">${msg}</li>`);
                    }
                }
            }

            if (tableNotifications.length > 0) {
                hasAnyNotification = true;
                finalHtml += `
                    <div style="margin-bottom: 15px;">
                        <strong style="display: block; margin-bottom: 5px;">■ ${config.tableName}</strong>
                        <ul style="margin-top: 0; margin-bottom: 8px;">
                            ${tableNotifications.join('')}
                        </ul>
                        <a href="${config.linkUrl}/index" class="button ui-button ui-corner-all ui-widget" style="background: #f39c12; color: white; text-decoration: none; padding: 4px 10px; font-size: 0.9em;">
                            ${config.tableName}の一覧を開く
                        </a>
                    </div>
                `;
            }
        }

        // --- UI表示の切り替え ---
        const panelDiv = document.getElementById('DashboardNotificationPanel');

        if (panelDiv) {
            if (hasAnyNotification) {
                // ▼ 通知あり：黄色い警告スタイル ＋ タイトルあり
                panelDiv.style.background = '#fff3cd';
                panelDiv.style.border = '1px solid #ffeeba';
                panelDiv.style.color = '#856404';
                panelDiv.innerHTML = `
                    <h3 style="margin-top: 0; color: #856404; font-size: 1.1em; border-bottom: 1px solid #ffeeba; padding-bottom: 8px;">
                        <span class="ui-icon ui-icon-notice" style="display:inline-block; vertical-align:middle;"></span> 要確認の案件があります
                    </h3>
                    <div style="font-size: 0.95em;">
                        ${finalHtml}
                    </div>
                `;
            } else {
                // ▼ 通知なし：灰色のシンプルスタイル ＋ タイトルなし
                panelDiv.style.background = '#f5f5f5';
                panelDiv.style.border = '1px solid #ddd';
                panelDiv.style.color = '#666';
                panelDiv.innerHTML = `
                    <div style="font-size: 0.95em; padding: 5px 0;">
                        通知はありません
                    </div>
                `;
            }
            // パネルを表示
            panelDiv.style.display = 'block';
        }
    })();
};