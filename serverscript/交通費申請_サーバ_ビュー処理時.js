//<定数定義>
const KEIRI_GROUP_ID = 2; // 経理担当グループID
const GAAPP_GROUP_ID = 3; // 総務承認者グループID
const STATUS_UNDERREV = "300"; // 決済待ち
const STATUS_FINALAPP = "400"; // 総務承認待ち


try {
    // ログインしているユーザーのID
    const userId = context.UserId.toString();
    
    // ★ 管理者以外（一般ユーザー、経理、総務など）の場合はフィルタ処理を実行
    if(context.UserId !== 1) {
        
        // グループ情報を取得し、所属しているかを判定
        const keiriGroup = groups.Get(KEIRI_GROUP_ID);
        const isKeiri = keiriGroup ? keiriGroup.ContainsUser(context.UserId) : false;
        
        const gaGroup = groups.Get(GAAPP_GROUP_ID);
        const isGA = gaGroup ? gaGroup.ContainsUser(context.UserId) : false;
        
        // --------------------------------------------------------
        // OR条件を組み立てるためのオブジェクト
        // --------------------------------------------------------
        let orConditions = {};
        
        // 【全員共通】自身が「申請者(ClassA)」または「上長(ClassB)」であること
        orConditions.ClassA = JSON.stringify([userId]);
        orConditions.ClassB = JSON.stringify([userId]);
        
        let statuses = []; // 拾い上げるステータスのリスト
        
        // 【経理担当】の追加条件
        if (isKeiri) {
            orConditions.ClassC = JSON.stringify([userId]); // 自身が「経理担当(ClassC)」
            statuses.push(STATUS_UNDERREV); // 決済待ち
        }
        
        // 【総務承認者】の追加条件
        if (isGA) {
            statuses.push(STATUS_FINALAPP); // 総務承認待ち
        }
        
        // グループ権限によってステータス条件が追加されていればセットする
        if (statuses.length > 0) {
            orConditions.Status = JSON.stringify(statuses);
        }
        
        // --------------------------------------------------------
        // view.Filtersの「or_」から始まる任意のプロパティ名に、
        // JSON文字列としてセットすると、自動でOR検索を行ってくれます
        // --------------------------------------------------------
        view.Filters.or_DisplayControl = JSON.stringify(orConditions);
        
        // context.Log(`ユーザーID: ${userId} の表示フィルタを適用しました。(経理: ${isKeiri}, 総務: ${isGA})`);
    }
    
} catch (e) {
    context.Log("表示制限スクリプトエラー: " + e.message);
}