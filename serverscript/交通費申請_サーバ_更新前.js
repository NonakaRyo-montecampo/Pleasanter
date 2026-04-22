//交通費申請　サーバスクリプト　更新前
const KEIRI_GROUP_ID = 2; 
const GAAPP_GROUP_ID = 3; 

try {
    // ログインしているユーザーIDとステータスを取得
    const userId = context.UserId;
    const currentStatus = model.Status;
    
    // 管理者（ID: 1）はチェックをバイパス
    if (userId !== 1) {
        // サーバー側の機能でグループ所属を完璧に判定
        const isKeiri = groups.Get(KEIRI_GROUP_ID).ContainsUser(userId);
        const isGAApp = groups.Get(GAAPP_GROUP_ID).ContainsUser(userId);
        
        const isSuperior = (userId.toString() === model.ClassB); // 上長（ClassB）か

        // --- ステータスごとの厳格な防御壁 ---
        if (currentStatus == 300 || currentStatus == 500) {
            // 決済待ち(300) or 精算待ち(500) -> 経理担当しか更新できない
            if (!isKeiri) {
                context.Error("【権限エラー】経理担当者以外は、このステータスの申請を操作できません。");
            }
        } 
        else if (currentStatus == 400) {
            // 総務承認待ち(400) -> 総務承認者しか更新できない
            if (!isGAApp) {
                context.Error("【権限エラー】総務承認者以外は、このステータスの申請を操作できません。");
            }
        } 
        else if (currentStatus == 200) {
            // 上長承認待ち(200) -> 指定された上長しか更新できない
            if (!isSuperior) {
                context.Error("【権限エラー】指定された上長以外は、承認処理を行えません。");
            }
        }
    }
} catch (e) {
    context.Log("不正更新ブロックスクリプトエラー: " + e.message);
}